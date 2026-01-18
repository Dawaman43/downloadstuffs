//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config'

export default [
	{
		ignores: [
			'.output/**',
			'node_modules/**',
			// Config files are not part of the TS project and shouldn't be linted
			'eslint.config.js',
			'prettier.config.js',
		],
	},
	...tanstackConfig,
]
