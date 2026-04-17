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

  $: collectionOptions = collections.map((c) => ({
    label: c.label,
    value: c.value,
  }));

  const placeholder = `{
  "Grey": {
    "50": {
      "value": "#f8f8f8",
      "type": "color"
    },
    "100": {
      ...`;

  function handleImport() {
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
    },
  });

  // Request options on load
  sendToPlugin("populateOptions");
</script>

<div class="plugin-container">
  <PluginLayout>
    <FieldGroup label="Huetone JSON">
      <Textarea bind:value={jsonInput} {placeholder} rows={9} />
    </FieldGroup>

    <FieldGroup label="Select collection">
      <Dropdown
        menuItems={collectionOptions}
        bind:value={selectedCollection}
        placeholder="Select existing collection"
      />
    </FieldGroup>

    <Checkbox bind:checked={overwrite}>
      Overwrite (changed) existing variables
    </Checkbox>

    <FieldGroup label="Create new collection">
      <Input bind:value={newCollectionName} placeholder="Collection name" />
    </FieldGroup>
  </PluginLayout>

  <Footer variant="full">
    <Button variant="primary" on:click={handleImport} fullWidth>
      Import variables
    </Button>
  </Footer>
</div>

<style>
  .plugin-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }
</style>
