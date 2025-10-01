import { describe, it, expect } from "vitest"
import { MercuryStrategy } from "../MercuryStrategy"

describe("MercuryStrategy.stripLineNumbers", () => {
	const strategy = new MercuryStrategy()

	it("should preserve indentation when stripping line numbers", () => {
		const input = `\
1 | class User {
2 |     constructor(name, age) {
3 |         this.name = name;
4 |     }
5 | }`

		const result = (strategy as any).stripLineNumbers(input)

		expect(result).toMatchInlineSnapshot(`
			"class User {
			    constructor(name, age) {
			        this.name = name;
			    }
			}"
		`)
	})

	it("should handle mixed indentation patterns", () => {
		const input = `1 | function test() {
2 |     if (condition) {
3 |         return "nested";
4 |     }
5 | }`

		const result = (strategy as any).stripLineNumbers(input)

		expect(result).toMatchInlineSnapshot(`
			"function test() {
			    if (condition) {
			        return "nested";
			    }
			}"
		`)
	})

	it("should strip line numbers without space before pipe (benchmark format)", () => {
		const input = `9|    user.active
10|];`

		const result = (strategy as any).stripLineNumbers(input)

		expect(result).toBe(`    user.active
];`)
	})

	it("should handle line numbers at start of content", () => {
		const input = `1|const x = 1;
2|const y = 2;`

		const result = (strategy as any).stripLineNumbers(input)

		expect(result).toBe(`const x = 1;
const y = 2;`)
	})

	it("should handle multi-digit line numbers", () => {
		const input = `98|    return value;
99|}
100|
101|// Next function`

		const result = (strategy as any).stripLineNumbers(input)

		expect(result).toBe(`    return value;
}

// Next function`)
	})
})

describe("MercuryStrategy.stripMercuryMarkers", () => {
	const strategy = new MercuryStrategy()

	it("should strip markers and preserve indentation", () => {
		const input = `<|code_to_edit|>
1 | class User {
2 |     constructor() {}
3 | }
<|/code_to_edit|>`

		const result = (strategy as any).stripMercuryMarkers(input)

		expect(result).toMatchInlineSnapshot(`
			"class User {
			    constructor() {}
			}"
		`)
	})
})
