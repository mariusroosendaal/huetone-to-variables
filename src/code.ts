import {
  handleResize,
  createSettingsStore,
} from "figma-plugin-utilities/lib/figma-helpers";
import {
  rgbToHex,
  hexToRgb,
  isValidHex,
} from "figma-plugin-utilities/lib/colors";
import { isColorValue } from "figma-plugin-utilities/lib/figma-variables";

// Separate keys, as saved by earlier versions, so users keep their choices.
const overwriteStore = createSettingsStore("overwrite", (raw) =>
  typeof raw === "boolean" ? raw : undefined,
);
const collectionStore = createSettingsStore("selectedCollection", (raw) =>
  typeof raw === "string" ? raw : undefined,
);

// Show the plugin UI
figma.showUI(__html__, { themeColors: true, width: 240, height: 364 });

interface HuetoneColorData {
  type: string;
  value: string;
}

interface ColorEntry {
  name: string;
  hex: string;
}

function extractHuetoneColors(
  data: Record<string, unknown>,
): ColorEntry[] | null {
  const entries: ColorEntry[] = [];

  for (const [groupName, shades] of Object.entries(data)) {
    if (typeof shades !== "object" || shades === null || Array.isArray(shades))
      return null;

    for (const [shade, colorData] of Object.entries(
      shades as Record<string, unknown>,
    )) {
      if (typeof colorData !== "object" || colorData === null) return null;
      const entry = colorData as Partial<HuetoneColorData>;
      if (entry.type !== "color" || typeof entry.value !== "string")
        return null;
      if (!isValidHex(entry.value)) continue;
      entries.push({ name: `${groupName}/${shade}`, hex: entry.value });
    }
  }

  return entries.length > 0 ? entries : null;
}

function extractPrismColors(
  data: Record<string, unknown>,
): ColorEntry[] | null {
  const entries: ColorEntry[] = [];

  for (const [colorName, value] of Object.entries(data)) {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const hex = value[i];
        if (typeof hex === "string" && isValidHex(hex)) {
          entries.push({ name: `${colorName}/${i}`, hex });
        }
      }
    } else if (typeof value === "string" && isValidHex(value)) {
      entries.push({ name: colorName, hex: value });
    } else {
      return null;
    }
  }

  return entries.length > 0 ? entries : null;
}

function extractColors(data: Record<string, unknown>): ColorEntry[] | null {
  // Prism: top-level values are arrays or plain hex strings
  const firstValue = Object.values(data)[0];
  if (Array.isArray(firstValue) || typeof firstValue === "string") {
    return extractPrismColors(data);
  }
  return extractHuetoneColors(data);
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "resize") {
    handleResize(msg);
    return;
  }

  if (msg.type === "populateOptions") {
    try {
      const localVariables =
        await figma.variables.getLocalVariablesAsync("COLOR");

      const uniqueCollectionIds = [
        ...new Set(localVariables.map((v) => v.variableCollectionId)),
      ];
      const fetchedCollections = await Promise.all(
        uniqueCollectionIds.map((id) =>
          figma.variables.getVariableCollectionByIdAsync(id),
        ),
      );
      const options = fetchedCollections
        .filter(Boolean)
        .map((c) => ({ label: c!.name, value: c!.id }));

      const savedOverwrite = await overwriteStore.load();
      const savedCollection = await collectionStore.load();

      figma.ui.postMessage({
        type: "populateOptions",
        options,
        savedOverwrite,
        savedCollection,
      });
    } catch (error) {
      console.error("Error fetching variables or collections:", error);
      figma.ui.postMessage({ type: "populateOptions", options: [] });
      figma.notify("Error fetching variables or collections", { error: true });
    }
  }

  if (msg.type === "generate-variables") {
    try {
      if (typeof msg.json !== "string" || msg.json.trim() === "") {
        figma.notify("No JSON provided.", { error: true });
        return;
      }

      const jsonData: unknown = JSON.parse(msg.json);

      if (
        typeof jsonData !== "object" ||
        jsonData === null ||
        Array.isArray(jsonData)
      ) {
        figma.notify(
          "Invalid JSON — make sure you're pasting the full palette object.",
          { error: true },
        );
        return;
      }

      const colors = extractColors(jsonData as Record<string, unknown>);

      if (!colors) {
        figma.notify(
          "Unrecognized JSON format. Paste a Huetone or Prism palette.",
          { error: true },
        );
        return;
      }

      const overwrite = !!msg.overwrite;

      let collection: VariableCollection | null = null;

      if (
        msg.selectedCollection &&
        typeof msg.selectedCollection === "string"
      ) {
        collection = await figma.variables.getVariableCollectionByIdAsync(
          msg.selectedCollection,
        );
      } else if (
        msg.newCollection &&
        typeof msg.newCollection === "string" &&
        msg.newCollection.trim()
      ) {
        collection = figma.variables.createVariableCollection(
          msg.newCollection.trim(),
        );
      }

      if (!collection) {
        figma.notify("Select a collection or enter a name for a new one.", {
          error: true,
        });
        return;
      }

      const modes = collection.modes;
      if (modes.length === 0) {
        figma.notify("No modes found in the collection.", { error: true });
        return;
      }
      const modeId = modes[0].modeId;

      const allVariables = await figma.variables.getLocalVariablesAsync();
      const collectionId = collection.id;
      const variablesByName = new Map<string, Variable>(
        allVariables
          .filter((v) => v.variableCollectionId === collectionId)
          .map((v) => [v.name, v]),
      );

      for (const { name, hex } of colors) {
        const rgb = hexToRgb(hex);
        if (!rgb) continue;
        const existingVariable = variablesByName.get(name);

        if (existingVariable) {
          const currentValue = existingVariable.valuesByMode[modeId];
          if (overwrite && isColorValue(currentValue)) {
            const currentHex = rgbToHex(currentValue);
            if (hex.toUpperCase() !== currentHex) {
              existingVariable.setValueForMode(modeId, rgb);
            }
          }
        } else {
          const colorVariable = figma.variables.createVariable(
            name,
            collection,
            "COLOR",
          );
          colorVariable.setValueForMode(modeId, rgb);
        }
      }

      await overwriteStore.save(overwrite);
      if (
        msg.selectedCollection &&
        typeof msg.selectedCollection === "string"
      ) {
        await collectionStore.save(msg.selectedCollection);
      }

      figma.notify(
        "Variables imported successfully. Press Ctrl/Cmd+Z to undo.",
      );
      figma.ui.close();
      figma.closePlugin();
    } catch (error) {
      console.error("Error processing JSON:", error);
      figma.notify("Failed to import variables. Please check your JSON.", {
        error: true,
      });
    } finally {
      figma.ui.postMessage({ type: "done" });
    }
  }
};
