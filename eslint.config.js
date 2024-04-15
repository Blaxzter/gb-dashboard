import pluginVue from "eslint-plugin-vue";
import prettierPlugin from "eslint-plugin-prettier/recommended";

export default [
  ...pluginVue.configs["flat/recommended"],
  prettierPlugin,
  {
    rules: {
      "vue/no-v-html": "off",
    },
  },
];
