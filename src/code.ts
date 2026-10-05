import {
  handleResize,
  createSettingsStore,
  showError,
  showNotice,
  showSuccess,
} from "figma-plugin-utilities/lib/figma-helpers";
import { joinList, plural, UNDO } from "figma-plugin-utilities/lib/format";
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
      showError(
        "Couldn't read the variable collections. Reopen the plugin to try again.",
      );
    }
  }

  if (msg.type === "generate-variables") {
    try {
      if (typeof msg.json !== "string" || msg.json.trim() === "") {
        showNotice("Paste a Huetone or Prism palette, then import.");
        return;
      }

      let jsonData: unknown;
      try {
        jsonData = JSON.parse(msg.json);
      } catch {
        showError(
          "The JSON isn't valid. Copy the palette from Huetone or Prism again, then paste all of it.",
        );
        return;
      }

      if (
        typeof jsonData !== "object" ||
        jsonData === null ||
        Array.isArray(jsonData)
      ) {
        showError(
          "The JSON isn't a palette. Copy the palette from Huetone or Prism again, then paste all of it.",
        );
        return;
      }

      const colors = extractColors(jsonData as Record<string, unknown>);

      if (!colors) {
        showError(
          "The JSON isn't a Huetone or Prism palette. Paste one of those.",
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
        showNotice("Choose a collection, or name a new one, then import.");
        return;
      }

      const modes = collection.modes;
      if (modes.length === 0) {
        showError(
          `"${collection.name}" has no modes. Add one, or choose another collection.`,
        );
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

      let created = 0;
      let updated = 0;
      let kept = 0;
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
              updated++;
            }
          } else if (
            !isColorValue(currentValue) ||
            hex.toUpperCase() !== rgbToHex(currentValue)
          ) {
            kept++;
          }
        } else {
          const colorVariable = figma.variables.createVariable(
            name,
            collection,
            "COLOR",
          );
          colorVariable.setValueForMode(modeId, rgb);
          created++;
        }
      }

      await overwriteStore.save(overwrite);
      if (
        msg.selectedCollection &&
        typeof msg.selectedCollection === "string"
      ) {
        await collectionStore.save(msg.selectedCollection);
      }

      const keptNote =
        kept > 0
          ? ` Kept ${plural(kept, "variable")} with other values; turn on Update existing variables to replace them.`
          : "";
      if (created === 0 && updated === 0) {
        showNotice(
          `Nothing to import: "${collection.name}" already has these colors.${keptNote}`,
        );
        return;
      }
      const changes = joinList(
        [
          created > 0 && `created ${plural(created, "variable")}`,
          updated > 0 && `updated ${plural(updated, "variable")}`,
        ].filter((part): part is string => !!part),
      );
      showSuccess(
        `${changes[0].toUpperCase()}${changes.slice(1)} in "${collection.name}".${keptNote} ${UNDO}`,
      );
      figma.ui.close();
      figma.closePlugin();
    } catch (error) {
      console.error("Error processing JSON:", error);
      showError(
        "Couldn't import the variables. Press Ctrl/Cmd+Z to undo anything half-made, then try again.",
      );
    } finally {
      figma.ui.postMessage({ type: "done" });
    }
  }
};
