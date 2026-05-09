// Show the plugin UI
figma.showUI(__html__, { themeColors: true, width: 320, height: 420 });

interface HuetoneColorData {
  type: string;
  value: string;
}

figma.ui.onmessage = async (msg) => {
  if (msg.type === "populateOptions") {
    try {
      const localVariables =
        await figma.variables.getLocalVariablesAsync("COLOR");

      // Fetch each collection at most once
      const collectionNames = new Map<string, string>();
      const collectionOrder: string[] = [];

      for (const variable of localVariables) {
        const collectionId = variable.variableCollectionId;
        if (!collectionNames.has(collectionId)) {
          const collection =
            await figma.variables.getVariableCollectionByIdAsync(collectionId);
          collectionNames.set(
            collectionId,
            collection?.name ?? "Unknown Collection",
          );
          collectionOrder.push(collectionId);
        }
      }

      const options = collectionOrder.map((id) => ({
        label: collectionNames.get(id)!,
        value: id,
      }));

      const savedOverwrite = await figma.clientStorage.getAsync("overwrite");
      const savedCollection =
        await figma.clientStorage.getAsync("selectedCollection");

      figma.ui.postMessage({
        type: "populateOptions",
        options,
        savedOverwrite:
          typeof savedOverwrite === "boolean" ? savedOverwrite : undefined,
        savedCollection:
          typeof savedCollection === "string" ? savedCollection : undefined,
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
        figma.ui.postMessage({ type: "done" });
        return;
      }

      const jsonData: unknown = JSON.parse(msg.json);

      if (
        typeof jsonData !== "object" ||
        jsonData === null ||
        Array.isArray(jsonData)
      ) {
        figma.notify("Invalid JSON: expected an object at the top level.", {
          error: true,
        });
        figma.ui.postMessage({ type: "done" });
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
        figma.notify("No valid collection selected or created.", {
          error: true,
        });
        figma.ui.postMessage({ type: "done" });
        return;
      }

      const modes = collection.modes;
      if (modes.length === 0) {
        figma.notify("No modes found in the collection.", { error: true });
        figma.ui.postMessage({ type: "done" });
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

      for (const [groupName, shades] of Object.entries(
        jsonData as Record<string, unknown>,
      )) {
        if (
          typeof shades !== "object" ||
          shades === null ||
          Array.isArray(shades)
        )
          continue;

        for (const [shade, colorData] of Object.entries(
          shades as Record<string, unknown>,
        )) {
          if (typeof colorData !== "object" || colorData === null) continue;

          const data = colorData as Partial<HuetoneColorData>;
          if (data.type !== "color" || typeof data.value !== "string") continue;

          const newHexColor = data.value;
          if (!isValidHex(newHexColor)) continue;

          const variableName = `${groupName}/${shade}`;
          const existingVariable = variablesByName.get(variableName);

          if (existingVariable) {
            const currentValue = existingVariable.valuesByMode[modeId];
            if (overwrite && isRGBColor(currentValue)) {
              const currentHexColor = rgbToHex(
                Math.round(currentValue.r * 255),
                Math.round(currentValue.g * 255),
                Math.round(currentValue.b * 255),
              );
              if (newHexColor.toUpperCase() !== currentHexColor.toUpperCase()) {
                existingVariable.setValueForMode(modeId, hexToRgb(newHexColor));
              }
            }
          } else {
            const colorVariable = figma.variables.createVariable(
              variableName,
              collection,
              "COLOR",
            );
            colorVariable.setValueForMode(modeId, hexToRgb(newHexColor));
          }
        }
      }

      await figma.clientStorage.setAsync("overwrite", overwrite);
      if (
        msg.selectedCollection &&
        typeof msg.selectedCollection === "string"
      ) {
        await figma.clientStorage.setAsync(
          "selectedCollection",
          msg.selectedCollection,
        );
      }

      figma.notify("Variables imported successfully. Press Cmd+Z to undo.");
      figma.ui.close();
      figma.closePlugin();
    } catch (error) {
      console.error("Error processing JSON:", error);
      figma.notify("Failed to import variables. Please check your JSON.", {
        error: true,
      });
      figma.ui.postMessage({ type: "done" });
    }
  }
};

function isValidHex(hex: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(hex);
}

function isRGBColor(value: unknown): value is RGB {
  return (
    typeof value === "object" &&
    value !== null &&
    "r" in value &&
    "g" in value &&
    "b" in value
  );
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

function hexToRgb(hex: string) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r: r / 255, g: g / 255, b: b / 255 };
}
