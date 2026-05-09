<script>
  import {
    Button,
    Checkbox,
    Dropdown,
    Input,
    Textarea,
  } from "figma-ui3-kit-svelte";
  import {
    PluginLayout,
    FieldGroup,
    Footer,
    sendToPlugin,
    createMessageHandler,
  } from "figma-plugin-utilities";

  let jsonInput = "";
  let overwrite = false;
  let collections = [];
  let selectedCollection = null;
  let newCollectionName = "";
  let isLoading = false;
  let collectionsLoaded = false;

  $: collectionOptions = collections.map((c) => ({
    label: c.label,
    value: c.value,
  }));

  $: hasCollection =
    selectedCollection !== null || newCollectionName.trim() !== "";
  $: canImport = jsonInput.trim() !== "" && hasCollection && !isLoading;

  const placeholder = `{
  "Grey": {
    "50": {
      "value": "#f8f8f8",
      "type": "color"
    },
    "100": {
      ...`;

  function handleImport() {
    if (!canImport) return;
    isLoading = true;
    sendToPlugin("generate-variables", {
      json: jsonInput,
      overwrite,
      selectedCollection: selectedCollection?.value || "",
      newCollection: newCollectionName,
    });
  }

  window.onmessage = createMessageHandler({
    populateOptions: (msg) => {
      collections = msg.options || [];
      collectionsLoaded = true;
      if (typeof msg.savedOverwrite === "boolean")
        overwrite = msg.savedOverwrite;
      if (msg.savedCollection) {
        const saved = collections.find((c) => c.value === msg.savedCollection);
        if (saved) selectedCollection = saved;
      }
    },
    done: () => {
      isLoading = false;
    },
  });

  sendToPlugin("populateOptions");
</script>

<div class="plugin-container">
  <PluginLayout>
    <FieldGroup label="Huetone JSON" labelFor="huetone-json">
      <Textarea
        bind:value={jsonInput}
        {placeholder}
        rows={9}
        id="huetone-json"
      />
    </FieldGroup>

    <FieldGroup label="Select collection">
      <Dropdown
        menuItems={collectionOptions}
        bind:value={selectedCollection}
        placeholder="Select existing collection"
        ariaLabel="Select collection"
      />
    </FieldGroup>

    {#if collectionsLoaded && collections.length === 0}
      <p class="hint">
        No collections found — enter a name below to create one.
      </p>
    {/if}

    <Checkbox bind:checked={overwrite}>
      Overwrite (changed) existing variables
    </Checkbox>

    <FieldGroup label="Create new collection" labelFor="new-collection-name">
      <Input
        bind:value={newCollectionName}
        placeholder="Collection name"
        id="new-collection-name"
      />
    </FieldGroup>
  </PluginLayout>

  <Footer variant="full">
    <Button
      variant="primary"
      on:click={handleImport}
      fullWidth
      disabled={!canImport}
    >
      {isLoading ? "Importing..." : "Import variables"}
    </Button>
  </Footer>
</div>

<style>
  .plugin-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .hint {
    margin: 4px 0 0;
    font-size: 11px;
    color: var(--figma-color-text-secondary);
  }
</style>
