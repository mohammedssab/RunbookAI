document.addEventListener("DOMContentLoaded", () => {
    // UI Elements
    const logInput = document.getElementById("log-input");
    const clearBtn = document.getElementById("clear-btn");
    const analyzeBtn = document.getElementById("analyze-btn");
    const presetBtns = document.querySelectorAll(".preset-btn");
    
    const emptyState = document.getElementById("empty-state");
    const loadingSkeleton = document.getElementById("loading-skeleton");
    const resultsCard = document.getElementById("results-card");
    
    const rootCauseBanner = document.getElementById("root-cause-banner");
    const scriptEditor = document.getElementById("script-editor");
    const copyScriptBtn = document.getElementById("copy-script-btn");
    const executeBtn = document.getElementById("execute-btn");
    
    const consoleSection = document.getElementById("console-section");
    const consoleStatusPulse = document.getElementById("console-status-pulse");
    const exitCodeBadge = document.getElementById("exit-code-badge");
    const terminalOutput = document.getElementById("terminal-output");
    const rawOutput = document.getElementById("raw-output");
    
    // Status Badges
    const backendStatusDot = document.getElementById("backend-status-dot");
    const backendStatusText = document.getElementById("backend-status-text");
    const ollamaStatusDot = document.getElementById("ollama-status-dot");
    const ollamaStatusText = document.getElementById("ollama-status-text");
    
    // Simulation Elements
    const simStatusBadge = document.getElementById("sim-status-badge");
    const simBreakBtn = document.getElementById("sim-break-btn");
    
    // Preset Log Contexts
    const PRESETS = {
        permission: `ubuntu@production-server:~$ cat /etc/shadow\ncat: /etc/shadow: Permission denied`,
        nginx: `2026-06-26 15:15:30 [error] 1450#1450: *120 nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)\n2026-06-26 15:15:30 [emerg] 1450#1450: nginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)\nnginx: [emerg] bind() to 0.0.0.0:80 failed (98: Address already in use)`,
        custom_script: `CRITICAL:test-service: Could not load configuration file /home/mohammed/RunbookAI/test-service.conf: Permission denied\nFATAL:test-service: Initialization failed.`
    };

    // 1. Preset Buttons Handler
    presetBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const type = btn.getAttribute("data-type");
            if (PRESETS[type]) {
                logInput.value = PRESETS[type];
                // Smooth scroll to top of input if needed
                logInput.focus();
            }
        });
    });

    // 2. Clear Button Handler
    clearBtn.addEventListener("click", () => {
        logInput.value = "";
        resetResultsUI();
    });

    // 3. Health Checks (Runs every 4 seconds)
    async function checkHealth() {
        try {
            const res = await fetch("/api/health");
            if (res.ok) {
                const data = await res.json();
                
                // Backend health
                backendStatusDot.className = "w-2.5 h-2.5 rounded-full bg-green-500 shadow-neon-green";
                backendStatusText.textContent = "Online";
                
                // Ollama / Model health
                if (data.ollama === "ok") {
                    ollamaStatusDot.className = "w-2.5 h-2.5 rounded-full bg-green-500 shadow-neon-green";
                    ollamaStatusText.textContent = "gemma4:e2b (Ready)";
                } else {
                    ollamaStatusDot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
                    ollamaStatusText.textContent = "Offline / Loading";
                }
            } else {
                setOfflineStatus();
            }
        } catch (e) {
            setOfflineStatus();
        }
    }

    function setOfflineStatus() {
        backendStatusDot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
        backendStatusText.textContent = "Offline";
        ollamaStatusDot.className = "w-2.5 h-2.5 rounded-full bg-red-500";
        ollamaStatusText.textContent = "Offline";
    }

    // 4. Simulation Status Check (Runs every 3 seconds)
    async function checkSimulationStatus() {
        try {
            const res = await fetch("/api/simulate/status");
            if (res.ok) {
                const data = await res.json();
                if (!data.exists) {
                    simStatusBadge.className = "px-2.5 py-0.5 text-[10px] rounded-full font-semibold border font-mono bg-slate-900 text-slate-400 border-slate-800";
                    simStatusBadge.textContent = "Not Created";
                } else if (!data.readable) {
                    simStatusBadge.className = "px-2.5 py-0.5 text-[10px] rounded-full font-semibold border font-mono bg-red-950/60 text-red-400 border-red-800/40 animate-pulse";
                    simStatusBadge.textContent = "Locked (000)";
                } else {
                    simStatusBadge.className = "px-2.5 py-0.5 text-[10px] rounded-full font-semibold border font-mono bg-emerald-950/60 text-emerald-400 border-emerald-800/40";
                    simStatusBadge.textContent = `Readable (${data.permissions})`;
                }
            }
        } catch (e) {
            // Silence status check errors
        }
    }

    // 5. Trigger Simulation Break Handler
    simBreakBtn.addEventListener("click", async () => {
        simBreakBtn.disabled = true;
        simBreakBtn.textContent = "Breaking...";
        try {
            const res = await fetch("/api/simulate", { method: "POST" });
            if (res.ok) {
                await checkSimulationStatus();
                // Auto paste the simulation log
                logInput.value = PRESETS.custom_script;
                logInput.focus();
            }
        } catch (e) {
            alert("Failed to trigger simulation break. Is backend running?");
        } finally {
            simBreakBtn.disabled = false;
            simBreakBtn.innerHTML = `
                <svg class="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
                Break Config File (chmod 000)
            `;
        }
    });

    // 6. Log Analyzer API Trigger
    analyzeBtn.addEventListener("click", async () => {
        const logText = logInput.value.trim();
        if (!logText) {
            alert("Please paste or choose a log first!");
            return;
        }

        // Show loading state
        emptyState.classList.add("hidden");
        resultsCard.classList.add("hidden");
        loadingSkeleton.classList.remove("hidden");
        analyzeBtn.disabled = true;
        analyzeBtn.innerHTML = `
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Triage in Progress...
        `;

        try {
            const res = await fetch("/api/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ log_text: logText })
            });

            if (!res.ok) throw new Error("Backend response error");

            const data = await res.json();
            
            // Populate data
            rootCauseBanner.textContent = data.root_cause;
            scriptEditor.value = data.fix_script;
            rawOutput.textContent = data.raw_analysis;
            
            // Show result cards
            loadingSkeleton.classList.add("hidden");
            resultsCard.classList.remove("hidden");
            
            // Reset terminal output in case previous runs exist
            consoleSection.classList.add("hidden");
            terminalOutput.textContent = "";

        } catch (e) {
            loadingSkeleton.classList.add("hidden");
            emptyState.classList.remove("hidden");
            alert("Error analyzing log. Please check if your backend is running.");
        } finally {
            analyzeBtn.disabled = false;
            analyzeBtn.innerHTML = `
                <span>Analyze & Triage</span>
                <svg class="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                </svg>
            `;
        }
    });

    // 7. Fix Execution API Trigger
    executeBtn.addEventListener("click", async () => {
        const script = scriptEditor.value.trim();
        if (!script) {
            alert("No script content to execute!");
            return;
        }

        // Show terminal / console area
        consoleSection.classList.remove("hidden");
        consoleStatusPulse.className = "w-2.5 h-2.5 bg-yellow-500 rounded-full animate-ping";
        
        exitCodeBadge.className = "text-xs font-mono px-2 py-0.5 rounded font-bold bg-yellow-950/80 border border-yellow-800/40 text-yellow-400";
        exitCodeBadge.textContent = "RUNNING";
        
        terminalOutput.textContent = `[runbookai-agent] Initializing resolution runner...\n[runbookai-agent] Executing bash subshell...\n\n`;
        executeBtn.disabled = true;
        executeBtn.textContent = "Executing Resolution...";

        try {
            const start = performance.now();
            const res = await fetch("/api/execute", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ script: script })
            });

            const duration = ((performance.now() - start) / 1000).toFixed(2);
            if (!res.ok) throw new Error("Subprocess runner failed to respond.");

            const data = await res.json();
            
            // Append terminal command output
            let outputText = ``;
            if (data.stdout) {
                outputText += `${data.stdout}\n`;
            }
            if (data.stderr) {
                outputText += `\x1b[31m[STDERR]\x1b[0m\n${data.stderr}\n`;
            }
            if (!data.stdout && !data.stderr) {
                outputText += `(Command returned no output to stdout or stderr)\n`;
            }
            outputText += `\n[runbookai-agent] Finished execution in ${duration}s.\n`;
            terminalOutput.textContent += outputText;
            terminalOutput.scrollTop = terminalOutput.scrollHeight;

            // Set final status badges
            if (data.exit_code === 0) {
                exitCodeBadge.className = "text-xs font-mono px-2 py-0.5 rounded font-bold bg-emerald-950/80 border border-emerald-800/40 text-emerald-400";
                exitCodeBadge.textContent = "EXIT 0 (SUCCESS)";
                consoleStatusPulse.className = "w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-neon-green";
            } else {
                exitCodeBadge.className = "text-xs font-mono px-2 py-0.5 rounded font-bold bg-red-950/80 border border-red-800/40 text-red-400";
                exitCodeBadge.textContent = `EXIT ${data.exit_code} (FAILED)`;
                consoleStatusPulse.className = "w-2.5 h-2.5 bg-red-500 rounded-full";
            }

            // Immediately check simulation status in case it was a permissions fix
            await checkSimulationStatus();

        } catch (e) {
            terminalOutput.textContent += `\n[runbookai-agent] CRITICAL EXCEPTION: ${e.message}\n`;
            exitCodeBadge.className = "text-xs font-mono px-2 py-0.5 rounded font-bold bg-red-950/80 border border-red-800/40 text-red-400";
            exitCodeBadge.textContent = "ERROR -1";
            consoleStatusPulse.className = "w-2.5 h-2.5 bg-red-500 rounded-full";
        } finally {
            executeBtn.disabled = false;
            executeBtn.innerHTML = `
                <svg class="w-5 h-5 text-emerald-100 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path>
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <span>Execute Resolution Fix</span>
            `;
        }
    });

    // 8. Copy script to clipboard
    copyScriptBtn.addEventListener("click", () => {
        navigator.clipboard.writeText(scriptEditor.value);
        copyScriptBtn.innerHTML = `
            <svg class="w-3.5 h-3.5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Copied!
        `;
        setTimeout(() => {
            copyScriptBtn.innerHTML = `
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path>
                </svg>
                Copy
            `;
        }, 2000);
    });

    // Helper functions
    function resetResultsUI() {
        emptyState.classList.remove("hidden");
        loadingSkeleton.classList.add("hidden");
        resultsCard.classList.add("hidden");
        consoleSection.classList.add("hidden");
        terminalOutput.textContent = "";
    }

    // Init Calls
    checkHealth();
    checkSimulationStatus();
    setInterval(checkHealth, 4000);
    setInterval(checkSimulationStatus, 3000);
});
