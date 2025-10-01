import { describe, it, expect } from "vitest"
import { GhostTestHarness, GhostTestCase } from "../../__tests__/GhostTestHarness"

/**
 * Legacy XML Strategy Tests
 * Tests the Legacy XML strategy with <change> XML format using CDATA
 */
describe("Legacy XML Strategy", () => {
	it("should complete function using XML change tags", async () => {
		const testCase: GhostTestCase = {
			name: "legacy-xml-function",
			inputFile: `function greetUser(name) {
    ␣
}`,
			mockResponse: `<change>
<search><![CDATA[function greetUser(name) {
    
}]]></search>
<replace><![CDATA[function greetUser(name) {
    return \`Hello, \${name}! Welcome to our application.\`;
}]]></replace>
</change>`,
			expectedOutput: `function greetUser(name) {
    return \`Hello, \${name}! Welcome to our application.\`;
}`,
			strategy: "legacy-xml",
		}

		const result = await GhostTestHarness.execute(testCase)
		expect(result.success).toBe(true)
		expect(result.finalContent).toBe(testCase.expectedOutput)
	})

	it("should complete conditional logic", async () => {
		const testCase: GhostTestCase = {
			name: "legacy-xml-conditional",
			inputFile: `function processOrder(order) {
    ␣
    return order;
}`,
			mockResponse: `<change>
<search><![CDATA[function processOrder(order) {
    
    return order;
}]]></search>
<replace><![CDATA[function processOrder(order) {
    if (!order.isValid) {
        throw new Error('Invalid order');
    }
    return order;
}]]></replace>
</change>`,
			expectedOutput: `function processOrder(order) {
    if (!order.isValid) {
        throw new Error('Invalid order');
    }
    return order;
}`,
			strategy: "legacy-xml",
		}

		const result = await GhostTestHarness.execute(testCase)
		expect(result.success).toBe(true)
		expect(result.finalContent).toBe(testCase.expectedOutput)
	})

	it("should complete array processing", async () => {
		const testCase: GhostTestCase = {
			name: "legacy-xml-array",
			inputFile: `function filterActiveUsers(users) {
    ␣
}`,
			mockResponse: `<change>
<search><![CDATA[function filterActiveUsers(users) {
    
}]]></search>
<replace><![CDATA[function filterActiveUsers(users) {
    return users.filter(user => user.isActive);
}]]></replace>
</change>`,
			expectedOutput: `function filterActiveUsers(users) {
    return users.filter(user => user.isActive);
}`,
			strategy: "legacy-xml",
		}

		const result = await GhostTestHarness.execute(testCase)
		expect(result.success).toBe(true)
		expect(result.finalContent).toBe(testCase.expectedOutput)
	})
})
