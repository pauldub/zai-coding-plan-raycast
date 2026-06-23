/// <reference types="@raycast/api">

/* 🚧 🚧 🚧
 * This file is auto-generated from the extension's manifest.
 * Do not modify manually. Instead, update the `package.json` file.
 * 🚧 🚧 🚧 */

/* eslint-disable @typescript-eslint/ban-types */

type ExtensionPreferences = {
  /** Z.ai API Key - Your z.ai API key (from z.ai → API Keys). Used to read your Coding Plan quota. */
  "apiKey": string
}

/** Preferences accessible in all the extension's commands */
declare type Preferences = ExtensionPreferences

declare namespace Preferences {
  /** Preferences accessible in the `show-usage` command */
  export type ShowUsage = ExtensionPreferences & {}
  /** Preferences accessible in the `usage-bar` command */
  export type UsageBar = ExtensionPreferences & {}
}

declare namespace Arguments {
  /** Arguments passed to the `show-usage` command */
  export type ShowUsage = {}
  /** Arguments passed to the `usage-bar` command */
  export type UsageBar = {}
}

