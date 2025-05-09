<script>
    import { liveChartMode } from '$lib/stores/configuration.js';
    import { onMount } from 'svelte';

    import Chart from 'chart.js/auto';
    
    let { 
        alivePercentage = $bindable(0),
        iterationCount = $bindable(0),
        behaviorData = $bindable({ increasing: 0, chaotic: 0, decreasing: 0 })
    } = $props();
    
    let chartElement;
    let chart;
    let maxDataPoints = 100;
    let chartMode = $state('count'); // Add mode state: 'count' or 'behavior'

    // Data for count mode
    let countData = Array(maxDataPoints).fill(0);
    
    // Data for behavior mode
    let behaviorDataHistory = $state(Array(maxDataPoints).fill({ increasing: 0, chaotic: 0, decreasing: 0 }));
    
    let lastIterationCount = -1;
    let averageBehavior = $state({ increasing: 0, chaotic: 0, decreasing: 0 });
    
    function updateChartData() {
        if (chartMode === 'count') {
            countData = [...countData.slice(1), alivePercentage];
            
            if (chart) {
                chart.data.datasets[0].data = [...countData];
                chart.update('none');
                chart.options.scales.y.max = Math.min(Math.max(...countData) * 2, 100);
            }
        } else {
            behaviorDataHistory = [...behaviorDataHistory.slice(1), { ...behaviorData }];
            
            const totalIncreasing = behaviorDataHistory.reduce((sum, data) => sum + data.increasing, 0);
            const totalChaotic = behaviorDataHistory.reduce((sum, data) => sum + data.chaotic, 0);
            const totalDecreasing = behaviorDataHistory.reduce((sum, data) => sum + data.decreasing, 0);
            
            averageBehavior = {
                increasing: totalIncreasing / behaviorDataHistory.length,
                chaotic: totalChaotic / behaviorDataHistory.length,
                decreasing: totalDecreasing / behaviorDataHistory.length
            };
            
            if (chart) {
                chart.data.datasets[0].data = behaviorDataHistory.map(d => d.increasing);
                chart.data.datasets[1].data = behaviorDataHistory.map(d => d.chaotic);
                chart.data.datasets[2].data = behaviorDataHistory.map(d => d.decreasing);
                chart.update('none');
            }
        }
    }
    
    $effect(() => {
        if (iterationCount !== lastIterationCount) {
            updateChartData();
            lastIterationCount = iterationCount;
        }
    });
    
    function switchMode(mode) {
        chartMode = mode;
        $liveChartMode = mode;
        if (chart) {
            chart.destroy();
        }
        createChart();
    }
    
    function createChart() {
        if (!chartElement) return;
        
        if (chartMode === 'count') {
            createCountChart();
        } else {
            createBehaviorChart();
        }
    }
    
    function createCountChart() {
        chart = new Chart(chartElement, {
            type: 'line',
            data: {
                labels: Array(maxDataPoints).fill(''),
                datasets: [{
                    label: 'Alive Cells (%)',
                    data: [...countData],
                    fill: true,
                    backgroundColor: 'rgba(34, 197, 94, 0.2)', // Green-500 with opacity
                    borderColor: 'rgba(34, 197, 94, 0.8)', // Green-500
                    borderWidth: 2,
                    pointRadius: 0,
                    tension: 0.4,
                    cubicInterpolationMode: 'monotone'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 10,
                        left: 10
                    }
                },
                animation: {
                    duration: 0 // Disable animation for better performance
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        position: 'right',
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                size: 10,
                                family: 'system-ui, sans-serif'
                            },
                            padding: 8,
                            maxTicksLimit: 5,
                            callback: function(value) {
                                return Math.round(value) + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }
    
    function createBehaviorChart() {
        chart = new Chart(chartElement, {
            type: 'line',
            data: {
                labels: Array(maxDataPoints).fill(''),
                datasets: [
                    {
                        label: 'Increasing',
                        data: behaviorDataHistory.map(d => d.increasing),
                        fill: 'origin',
                        backgroundColor: 'rgba(0, 0, 0, 0.2)', // Black with more transparency
                        borderColor: 'rgba(0, 0, 0, 0.8)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone'
                    },
                    {
                        label: 'Chaotic',
                        data: behaviorDataHistory.map(d => d.chaotic),
                        fill: '-1',
                        backgroundColor: 'rgba(38, 220, 38, 0.2)', // Red with more transparency
                        borderColor: 'rgba(38, 220, 38, 0.8)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone'
                    },
                    {
                        label: 'Decreasing',
                        data: behaviorDataHistory.map(d => d.decreasing),
                        fill: '-1',
                        backgroundColor: 'rgba(255, 255, 255, 0.2)', // White with more transparency
                        borderColor: 'rgba(255, 255, 255, 0.8)',
                        borderWidth: 2,
                        pointRadius: 0,
                        tension: 0.4,
                        cubicInterpolationMode: 'monotone'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                layout: {
                    padding: {
                        top: 10,
                        right: 10,
                        bottom: 40, // Increased bottom padding for labels and bar
                        left: 10
                    }
                },
                animation: {
                    duration: 0
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        enabled: false
                    }
                },
                scales: {
                    x: {
                        display: false,
                        stacked: true,
                        grid: {
                            display: false
                        }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        stacked: true,
                        position: 'right',
                        ticks: {
                            color: 'rgba(255, 255, 255, 0.8)',
                            font: {
                                size: 10,
                                family: 'system-ui, sans-serif'
                            },
                            padding: 8,
                            maxTicksLimit: 5,
                            callback: function(value) {
                                return Math.round(value) + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
    }
    
    onMount(() => {
        createChart();
        
        // Initial update
        updateChartData();
        
        // Clean up the chart instance when the component is destroyed
        return () => {
            if (chart) {
                chart.destroy();
            }
        };
    });
</script>

<div class="chart-container w-full h-48 bg-zinc-800/60 backdrop-blur-sm rounded-lg overflow-hidden border border-zinc-700/50">
    <div class="px-4 py-2 text-xs font-medium text-white/80 flex justify-between items-center border-b border-zinc-700/50">
        <div class="flex items-center gap-2">
            <span>{chartMode === 'count' ? 'Live Population' : 'Behavior Distribution'}</span>
            <div class="flex rounded-md overflow-hidden border border-zinc-600">
                <button 
                    class="px-2 py-1 text-xs {chartMode === 'count' ? 'bg-zinc-600 text-white' : 'bg-transparent text-zinc-400 hover:text-white'}"
                    onclick={() => switchMode('count')}
                >
                    Count
                </button>
                <button 
                    class="px-2 py-1 text-xs {chartMode === 'behavior' ? 'bg-zinc-600 text-white' : 'bg-transparent text-zinc-400 hover:text-white'}"
                    onclick={() => switchMode('behavior')}
                >
                    Behavior
                </button>
            </div>
        </div>
        {#if chartMode === 'count'}
            <span class="text-green-400 font-bold">{alivePercentage.toFixed(1)}%</span>
        {/if}
    </div>
    <div class="p-2 h-[calc(100%-32px)] relative">
        <canvas bind:this={chartElement}></canvas>
        
        {#if chartMode === 'behavior'}
            <div class="absolute bottom-8 left-0 right-0 mx-4 flex justify-between text-[10px] text-white/80">
                <span class="flex items-center gap-1"><div class="w-2 h-2 bg-black rounded-sm"></div>Increasing</span>
                <span class="flex items-center gap-1"><div class="w-2 h-2 bg-green-600 rounded-sm"></div>Chaotic</span>
                <span class="flex items-center gap-1"><div class="w-2 h-2 bg-white rounded-sm"></div>Decreasing</span>
            </div>
            
            <div class="absolute bottom-4 left-0 right-0 mx-4 h-1">
                <div class="relative w-full h-full flex rounded-md overflow-hidden">
                    <div 
                        class="h-full bg-black" 
                        style="width: {averageBehavior.increasing}%"
                    ></div>
                    <div 
                        class="h-full bg-green-600" 
                        style="width: {averageBehavior.chaotic}%"
                    ></div>
                    <div 
                        class="h-full bg-white" 
                        style="width: {averageBehavior.decreasing}%"
                    ></div>
                </div>
            </div>
        {/if}
    </div>
</div>

<style>
    .chart-container {
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }
</style> 