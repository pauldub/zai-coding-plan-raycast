import config from "@raycast/eslint-config";

// @raycast/eslint-config@2.1.1 embeds `raycast.configs.recommended` (an array)
// without spreading it, producing a nested array that eslint 9 rejects
// ("Unexpected array"). Flatten one level so the flat config is valid.
const flat = [].concat(...config);

export default flat;
