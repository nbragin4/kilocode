import { nextJsConfig } from "@roo-code/config-eslint/next-js"

export default [
	...nextJsConfig,
	{
		ignores: [
			".next/**",
			"dist/**",
			"**/__test_cases__/**",
			"**/__test_cases_autocomplete__/**",
			"**/__test_cases_migrated__/**",
		],
	},
]
