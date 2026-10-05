<script>
  import {
    Button,
    Checkbox,
    Dropdown,
    Input,
    Textarea,
    Tooltip,
  } from "figma-ui3-kit-svelte";
  import {
    PluginLayout,
    FieldGroup,
    Footer,
    sendToPlugin,
    createMessageHandler,
    resizeToFit,
  } from "figma-plugin-utilities";

  let jsonInput = "";
  let overwrite = false;
  let collections = [];
  let selectedCollection = null;
  let newCollectionName = "";
  let isLoading = false;
  // The JSON last sent, and what the plugin found wrong with it as a palette
  let paletteError = { json: "", message: "" };

  const NEW_COLLECTION_SENTINEL = "__new__";

  $: collectionOptions = [
    ...collections.map((c) => ({ label: c.label, value: c.value })),
    { label: "Create new collection…", value: NEW_COLLECTION_SENTINEL },
  ];

  $: isCreatingNew = selectedCollection?.value === NEW_COLLECTION_SENTINEL;
  $: resizeToFit({ width: 240, height: isCreatingNew ? 428 : 364 });
  $: hasCollection =
    selectedCollection !== null &&
    (!isCreatingNew || newCollectionName.trim() !== "");
  $: jsonError =
    checkJson(jsonInput) ||
    (paletteError.json === jsonInput ? paletteError.message : "");
  $: canImport =
    jsonInput.trim() !== "" && !jsonError && hasCollection && !isLoading;
  $: importTooltip = !jsonInput.trim()
    ? "Paste a Huetone or Prism palette to import."
    : jsonError
      ? jsonError
      : !hasCollection
        ? "Choose a collection, or name a new one."
        : "";

  // As code.ts checks it, so the problem shows under the field
  function checkJson(text) {
    if (!text.trim()) return "";
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return "The JSON isn't valid. Copy the palette from Huetone or Prism again, then paste all of it.";
    }
    return typeof data !== "object" || data === null || Array.isArray(data)
      ? "The JSON isn't a palette. Copy the palette from Huetone or Prism again, then paste all of it."
      : "";
  }

  const placeholder = `{
  "Grey": {
    "50": {
      "value": "#f8f8f8",
      "type": "color"
    },
    "100": {
      ...`;

  let sentJson = "";

  function handleImport() {
    if (!canImport) return;
    isLoading = true;
    sentJson = jsonInput;
    sendToPlugin("generate-variables", {
      json: jsonInput,
      overwrite,
      selectedCollection: isCreatingNew ? "" : selectedCollection?.value || "",
      newCollection: isCreatingNew ? newCollectionName : "",
    });
  }

  window.onmessage = createMessageHandler({
    populateOptions: (msg) => {
      collections = msg.options || [];
      if (typeof msg.savedOverwrite === "boolean")
        overwrite = msg.savedOverwrite;
      if (msg.savedCollection) {
        const saved = collections.find((c) => c.value === msg.savedCollection);
        if (saved) selectedCollection = saved;
      } else if (collections.length === 0) {
        selectedCollection = {
          label: "Create new collection…",
          value: NEW_COLLECTION_SENTINEL,
        };
      }
    },
    paletteError: (msg) => {
      paletteError = { json: sentJson, message: msg.message };
    },
    done: () => {
      isLoading = false;
    },
  });

  sendToPlugin("populateOptions");
</script>

<div class="plugin-container">
  <PluginLayout>
    <FieldGroup label="Color JSON" labelFor="color-json">
      <Textarea
        bind:value={jsonInput}
        {placeholder}
        rows={9}
        id="color-json"
        variant="code"
        invalid={!!jsonError}
        errorMessage={jsonError}
      />
    </FieldGroup>

    <FieldGroup label="Collection">
      <Dropdown
        menuItems={collectionOptions}
        bind:value={selectedCollection}
        placeholder="Select collection"
        ariaLabel="Collection"
      />
    </FieldGroup>

    {#if isCreatingNew}
      <FieldGroup label="New collection name" labelFor="new-collection-name">
        <Input
          bind:value={newCollectionName}
          placeholder="Collection name"
          id="new-collection-name"
        />
      </FieldGroup>
    {/if}

    <Checkbox bind:checked={overwrite}>Update existing variables</Checkbox>
  </PluginLayout>

  <Footer variant="full">
    <Tooltip label={importTooltip} disabled={canImport}>
      <Button
        variant="primary"
        on:click={handleImport}
        fullWidth
        ariaDisabled={!canImport}
      >
        {isLoading ? "Importing..." : "Import variables"}
      </Button>
    </Tooltip>
  </Footer>
</div>

<style>
  .plugin-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
