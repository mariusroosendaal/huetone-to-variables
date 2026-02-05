// Show the plugin UI
figma.showUI(__html__, { themeColors: true, width: 320, height: 420 });

// Main plugin logic
figma.ui.onmessage = async (msg) => {
  if (msg.type === "populateOptions") {
    try {
      const localVariables =
        await figma.variables.getLocalVariablesAsync("COLOR");
      const collections = {};
      //console.log(localVariables);
      // Organize variables by collection
      for (const variable of localVariables) {
        const collectionId = variable.variableCollectionId;

        let collectionName = "Unknown Collection";
        if (collectionId) {
          const collection =
            await figma.variables.getVariableCollectionByIdAsync(collectionId);
          collectionName = collection.name || collectionName;
        }

        if (!collections[collectionId]) {
          collections[collectionId] = { name: collectionName, variables: [] };
        }

        collections[collectionId].variables.push(variable);
      }

      // Prepare options for the UI dropdown
      const options = Object.keys(collections).map((collectionId) => ({
        label: collections[collectionId].name,
        value: collectionId,
      }));
      //console.log(options);
      figma.ui.postMessage({
        type: "populateOptions",
        options: options,
      });
    } catch (error) {
      console.error("Error fetching variables or collections:", error);
      figma.notify("Error fetching variables or collections:", error);
    }
  }

  if (msg.type === "generate-variables") {
    try {
      const jsonData = JSON.parse(msg.json);
      const overwrite = msg.overwrite;

      // Determine which collection to use
      let collection = null;

      if (msg.selectedCollection) {
        collection = await figma.variables
          .getLocalVariableCollectionsAsync()
          .then((collections) =>
            collections.find((c) => c.id === msg.selectedCollection),
          );
      } else if (msg.newCollection) {
        collection = figma.variables.createVariableCollection(
          msg.newCollection,
        );
      }
      if (!collection) {
        figma.notify("No valid collection selected or created.");
        return;
      }

      // Retrieve modes from the collection
      const modes = collection.modes;
      console.log(modes);
      if (modes.length === 0) {
        figma.notify("No modes found in the collection!");
        return;
      }
      const modeId = modes[0].modeId; // Assuming first mode, adjust if needed

      // Retrieve all variables in the selected collection
      const allVariables = await figma.variables.getLocalVariablesAsync();
      const allVariablesInCollection = allVariables.filter(
        (variable) => variable.variableCollectionId === collection.id,
      );

      // Process the JSON data
      for (const [groupName, shades] of Object.entries(jsonData)) {
        for (const [shade, colorData] of Object.entries(shades)) {
          if (colorData.type === "color") {
            const variableName = `${groupName}/${shade}`;

            // Find if a variable with this name already exists in the collection
            const existingVariable = allVariablesInCollection.find(
              (variable) => variable.name === variableName,
            );
            const newHexColor = colorData.value; // Get new color from JSON

            if (existingVariable) {
              const currentValue = existingVariable.valuesByMode[modeId]; // Get current value for the mode

              const currentHexColor = rgbToHex(
                Math.round(currentValue.r * 255),
                Math.round(currentValue.g * 255),
                Math.round(currentValue.b * 255),
              );
              const hasChanged =
                newHexColor.toUpperCase() !== currentHexColor.toUpperCase(); // Compare as uppercase

              if (hasChanged && overwrite) {
                console.log(`Overwriting existing variable: ${variableName}`);
                figma.notify(`Overwriting existing variable: ${variableName}`);
                existingVariable.setValueForMode(modeId, hexToRgb(newHexColor)); // Set new color
              }
            } else {
              const colorVariable = figma.variables.createVariable(
                variableName,
                collection,
                "COLOR",
              );
              colorVariable.setValueForMode(modeId, hexToRgb(newHexColor)); // Set color for the mode
            }
          }
        }
      }

      figma.notify("Variables imported successfully");
    } catch (error) {
      console.error("Error processing JSON:", error);
      figma.notify("Failed to import variables. Please check your JSON.");
    }
    figma.ui.close();
    figma.closePlugin();
  }
};

function rgbToHex(r, g, b) {
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase()}`;
}

// Helper function to convert hex to RGB
function hexToRgb(hex: string) {
  const bigint = parseInt(hex.slice(1), 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return { r: r / 255, g: g / 255, b: b / 255 }; // Normalize to 0-1 range
}
