// Clean executeTest function for server.js
async function executeTest(testName, profile, mode = "live") {
    return new Promise((resolve) => {
        console.log(`🧪 Executing ${testName} with ${profile} in ${mode} mode`)

        // Use the CLI package to run the test
        const cliProcess = spawn('pnpm', ['benchmark', 'run', '--tests', testName, '--profile', profile, '--mode', mode, '--format', 'json'], {
            cwd: path.join(__dirname, '../packages/ghost-benchmarks'),
            env: {
                ...process.env,
                OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY,
            },
            stdio: ['pipe', 'pipe', 'pipe']
        })

        let stdout = ''
        let stderr = ''

        cliProcess.stdout.on('data', (data) => {
            stdout += data.toString()
        })

        cliProcess.stderr.on('data', (data) => {
            stderr += data.toString()
        })

        cliProcess.on('close', (code) => {
            if (code === 0) {
                try {
                    // Parse the JSON result from the CLI
                    const result = JSON.parse(stdout)
                    console.log('✅ CLI test execution successful')

                    // Transform CLI result to web format
                    const webResult = {
                        success: result.passedTests > 0,
                        testName,
                        profile,
                        mode,
                        passed: result.passedTests > 0,
                        executionTime: result.averageExecutionTime || 0,
                        groups: result.results?.[0]?.metrics?.groupCount || 0,
                        selectedGroup: result.results?.[0]?.metrics?.selectedGroup || 0,
                    }

                    resolve(webResult)
                } catch (parseError) {
                    console.log('❌ Failed to parse CLI result:', parseError)
                    resolve({
                        success: false,
                        testName,
                        profile,
                        mode,
                        passed: false,
                        error: `Parse error: ${parseError.message}`,
                        executionTime: 0
                    })
                }
            } else {
                console.log(`❌ CLI execution failed with code: ${code}`)
                console.log(`❌ stderr: ${stderr}`)
                resolve({
                    success: false,
                    testName,
                    profile,
                    mode,
                    passed: false,
                    error: `CLI exit code ${code}: ${stderr}`,
                    executionTime: 0
                })
            }
        })

        // Timeout after 30 seconds
        setTimeout(() => {
            if (!cliProcess.killed) {
                cliProcess.kill('SIGTERM')
                resolve({
                    success: false,
                    testName,
                    profile,
                    mode,
                    passed: false,
                    error: 'Test execution timed out after 30 seconds',
                    executionTime: 0
                })
            }
        }, 30000)
    })
}