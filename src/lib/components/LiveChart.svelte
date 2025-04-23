<script>
    import { onMount } from 'svelte';
    import Chart from 'chart.js/auto';
    
    let { 
        alivePercentage = $bindable(0),
        iterationCount = $bindable(0) 
    } = $props();
    let chartElement;
    let chart;
    let maxDataPoints = 100;
    
    let chartData = Array(maxDataPoints).fill(0);
    let lastIterationCount = -1;
    
    function updateChartData() {
        chartData = [...chartData.slice(1), alivePercentage];
        
        if (chart) {
            chart.data.datasets[0].data = [...chartData];
            chart.update('none');

            chart.options.scales.y.max = Math.min(Math.max(...chartData) * 2, 100);
        }
    }
    
    $effect(() => {
        // Update chart based on iteration count changing, not just percentage
        if (iterationCount !== lastIterationCount) {
            updateChartData();
            lastIterationCount = iterationCount;
        }
    });
    
    onMount(() => {
        if (chartElement) {
            chart = new Chart(chartElement, {
                type: 'line',
                data: {
                    labels: Array(maxDataPoints).fill(''),
                    datasets: [{
                        label: 'Alive Cells (%)',
                        data: [...chartData],
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
            
            // Initial update
            updateChartData();
            
            // Clean up the chart instance when the component is destroyed
            return () => {
                if (chart) {
                    chart.destroy();
                }
            };
        }
    });
</script>

<div class="chart-container w-full h-36 bg-zinc-800/60 backdrop-blur-sm rounded-lg overflow-hidden border border-zinc-700/50">
    <div class="px-4 py-2 text-xs font-medium text-white/80 flex justify-between items-center border-b border-zinc-700/50">
        <span>Live Population</span>
        <span class="text-green-400 font-bold">{alivePercentage.toFixed(1)}%</span>
    </div>
    <div class="p-2 h-[calc(100%-32px)]">
        <canvas bind:this={chartElement}></canvas>
    </div>
</div>

<style>
    .chart-container {
        box-shadow: 0 8px 16px rgba(0, 0, 0, 0.2);
    }
</style> 