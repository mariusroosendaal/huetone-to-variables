# Huetone to Variables

Huetone to Variables imports a color palette from Huetone or GitHub Prism as color variables. The shade `50` of the palette `Grey`, for example, becomes the variable `Grey/50`.

## Import a palette

![](huetone-import.svg)

Export the palette as JSON from Huetone or Prism, then run the plugin.

1. **Color JSON** — the palette to import, in one of two formats. In Huetone's, each palette holds shades with a `value` and `"type": "color"`. In Prism's, each color is a list of hex values, which become numbered variables from `0` (`blue/0`, `blue/1`), or a single hex value. Only six-digit hex values import, such as `#f8f8f8`.
2. **Collection** — the collection the variables go to. The list shows the collections that already hold color variables. To create a collection, choose **Create new collection…** and enter a **New collection name**.
3. **Update existing variables** — gives each variable that already has a palette name the value from the palette.

Click **Import variables**. The plugin adds the missing variables, writes the values to the collection's first mode, then closes. Press Ctrl/Cmd+Z to undo. The next time it opens, the plugin selects the same existing collection again and keeps the **Update existing variables** choice.
