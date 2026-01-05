<script lang="ts">
    import { Button } from '$lib/components/ui/button';
    import * as DropdownMenu from '$lib/components/ui/dropdown-menu';
    import { Save, X, ArrowRight, ArrowLeft, CheckCircle2, AlertCircle, Trash2, Undo2, Redo2, Grid3x3, Map, MoreVertical, ZoomIn, ZoomOut, Maximize2, HelpCircle } from 'lucide-svelte';
    import { workflowEditorStore } from '../stores';
    import { NODE_COLORS } from '../constants';
    import type { FlowNode, FlowEdge } from '../types';
    import { toast } from 'svelte-sonner';
    import { onMount, tick } from 'svelte';

    let { active = true } = $props<{ active?: boolean }>();

    let canvasRef: HTMLDivElement;
    let isDragging = $state(false);
    let dragOffset = $state({ x: 0, y: 0 });
    let draggedNode: FlowNode | null = null;
    let draggedNodeElement: HTMLElement | null = null;
    let connectingFrom = $state<string | null>(null);
    let connectingMousePos = $state<{ x: number; y: number } | null>(null);
    let canvasPosition = $state({ x: 0, y: 0 });
    let scale = $state(1);
    let deleteZoneRef: HTMLDivElement;
    let isOverDeleteZone = $state(false);
    let lastStoreUpdate = $state({ x: 0, y: 0 });
    let storeUpdateTimer: number | null = null;
    let edgeRecalcKey = $state(0); // Force edge recalculation when nodes are rendered
    
    // Pan state
    let isPanning = $state(false);
    let panStart = $state({ x: 0, y: 0 });
    let panStartPosition = $state({ x: 0, y: 0 });
    let isSpacePressed = $state(false);
    
    // View options
    let showGrid = $state(true);
    let showMinimap = $state(false);
    let snapToGrid = $state(false);
    let showHelpDialog = $state(false);
    let isExecuting = $state(false);

    $effect(() => {
        if (workflowEditorStore.selectedNode) {
            const node = workflowEditorStore.nodes.find(n => n.id === workflowEditorStore.selectedNode!.id);
            if (node) {
                workflowEditorStore.selectedNode = node;
            }
        }
    });

    // Track previous active state to detect when component becomes active again
    let previousActive = $state(false);
    
    // Force edge recalculation when component becomes active (e.g., when switching tabs)
    $effect(() => {
        if (active && !previousActive && canvasRef && workflowEditorStore.nodes.length > 0) {
            // Component just became active, recalculate edges after DOM is ready
            tick().then(() => {
                // Use multiple delays to ensure DOM is fully laid out
                setTimeout(() => {
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => {
                            requestAnimationFrame(() => {
                                edgeRecalcKey++;
                            });
                        });
                    });
                }, 100);
            });
        }
        previousActive = active;
    });

    // Recalculate edges after nodes are loaded/rendered
    // This ensures DOM is fully laid out before calculating edge paths
    $effect(() => {
        if (workflowEditorStore.nodes.length > 0 && canvasRef) {
            // Use multiple requestAnimationFrame calls to ensure layout is complete
            // Also add a small timeout to ensure component is fully visible after tab switch
            const timeoutId = setTimeout(() => {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Double RAF ensures layout is complete
                        edgeRecalcKey++;
                    });
                });
            }, 50); // Small delay to ensure component is visible after tab switch
            
            return () => clearTimeout(timeoutId);
        }
    });
    
    // Also recalculate when edges change
    $effect(() => {
        if (workflowEditorStore.edges.length > 0 && canvasRef) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    edgeRecalcKey++;
                });
            });
        }
    });
    
    // Recalculate edges when canvas position or scale changes (for panning/zooming)
    $effect(() => {
        // Track canvasPosition and scale changes
        const _ = canvasPosition.x;
        const __ = canvasPosition.y;
        const ___ = scale;
        
        if (workflowEditorStore.edges.length > 0 && canvasRef) {
            // Use requestAnimationFrame to ensure DOM has updated after transform
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    edgeRecalcKey++;
                });
            });
        }
    });
    
    // Recalculate on mount to ensure edges render when component is first shown
    onMount(() => {
        if (workflowEditorStore.nodes.length > 0 && canvasRef) {
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    edgeRecalcKey++;
                });
            });
        }
        
        // Add global keyboard listeners for space key
        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
        };
    });

    function handleCanvasMouseDown(e: MouseEvent) {
        const target = e.target as HTMLElement;
        
        // Check if click is on canvas background (not on nodes or their children)
        // Allow clicks on: canvas itself, SVG elements (edges), or empty space
        const isCanvasBackground = 
            target === canvasRef || 
            target.classList.contains('workflow-canvas') ||
            target.tagName === 'svg' ||
            target.tagName === 'path' ||
            (target.closest('[data-node-id]') === null && target.closest('.connection-handle') === null);
        
        if (isCanvasBackground) {
            workflowEditorStore.selectNode(null);
            connectingFrom = null;
            connectingMousePos = null;
            
            // Start panning with:
            // 1. Middle mouse button
            // 2. Space + left click
            // 3. Left click on empty canvas (default behavior)
            if (e.button === 1 || (e.button === 0 && isSpacePressed) || (e.button === 0 && !isSpacePressed)) {
                e.preventDefault();
                e.stopPropagation();
                isPanning = true;
                panStart = { x: e.clientX, y: e.clientY };
                panStartPosition = { ...canvasPosition };
                canvasRef.style.cursor = 'grabbing';
                
                // Add document-level listeners for smooth panning even if mouse leaves canvas
                const handleDocumentPanMove = (moveEvent: MouseEvent) => {
                    if (isPanning) {
                        const deltaX = moveEvent.clientX - panStart.x;
                        const deltaY = moveEvent.clientY - panStart.y;
                        canvasPosition = {
                            x: panStartPosition.x + deltaX,
                            y: panStartPosition.y + deltaY
                        };
                        // Trigger edge recalculation during panning
                        requestAnimationFrame(() => {
                            edgeRecalcKey++;
                        });
                    }
                };
                
                const handleDocumentPanUp = (upEvent: MouseEvent) => {
                    if (isPanning) {
                        isPanning = false;
                        if (canvasRef) {
                            canvasRef.style.cursor = isSpacePressed ? 'grab' : '';
                        }
                    }
                    document.removeEventListener('mousemove', handleDocumentPanMove);
                    document.removeEventListener('mouseup', handleDocumentPanUp);
                };
                
                document.addEventListener('mousemove', handleDocumentPanMove);
                document.addEventListener('mouseup', handleDocumentPanUp);
            }
        }
    }

    function handleNodeMouseDown(node: FlowNode, e: MouseEvent) {
        e.stopPropagation();
        // Don't start dragging if clicking on delete button or connection handles
        if ((e.target as HTMLElement).closest('.node-delete-button, .connection-handle')) {
            return;
        }
        // Don't start dragging if space is pressed (pan mode)
        if (isSpacePressed) {
            return;
        }
        
        // Track initial mouse position to distinguish clicks from drags
        const initialMousePos = { x: e.clientX, y: e.clientY };
        const dragThreshold = 5; // pixels - if mouse moves more than this, it's a drag
        
        isDragging = true;
        draggedNode = node;
        draggedNodeElement = (e.currentTarget as HTMLElement);
        const rect = canvasRef.getBoundingClientRect();
        // Calculate offset from mouse to node position in canvas coordinates
        const mouseX = (e.clientX - rect.left - canvasPosition.x) / scale;
        const mouseY = (e.clientY - rect.top - canvasPosition.y) / scale;
        dragOffset = {
            x: mouseX - node.position.x,
            y: mouseY - node.position.y
        };
        // Initialize last store update position
        lastStoreUpdate = { x: node.position.x, y: node.position.y };
        // Disable transitions and optimize for dragging
        if (draggedNodeElement) {
            draggedNodeElement.style.transition = 'none';
            draggedNodeElement.style.willChange = 'left, top';
            // Force immediate position update to prevent any jump
            // Use setProperty to ensure it persists and overrides reactive binding
            draggedNodeElement.style.setProperty('left', `${node.position.x}px`);
            draggedNodeElement.style.setProperty('top', `${node.position.y}px`);
            // Force a reflow to ensure styles are applied
            void draggedNodeElement.offsetHeight;
        }
        
        let hasMoved = false;
        
        // Add document-level listeners for dragging (so it works even if mouse leaves canvas)
        const handleDocumentMouseMove = (moveEvent: MouseEvent) => {
            // Check if mouse has moved significantly (drag threshold)
            const deltaX = Math.abs(moveEvent.clientX - initialMousePos.x);
            const deltaY = Math.abs(moveEvent.clientY - initialMousePos.y);
            if (deltaX > dragThreshold || deltaY > dragThreshold) {
                hasMoved = true;
            }
            handleMouseMove(moveEvent);
        };
        
        const handleDocumentMouseUp = (upEvent: MouseEvent) => {
            handleMouseUp(upEvent);
            document.removeEventListener('mousemove', handleDocumentMouseMove);
            document.removeEventListener('mouseup', handleDocumentMouseUp);
            
            // Only select node if it was a click (not a drag)
            if (!hasMoved) {
                workflowEditorStore.selectNode(node);
            }
        };
        
        document.addEventListener('mousemove', handleDocumentMouseMove);
        document.addEventListener('mouseup', handleDocumentMouseUp);
    }


    function handleMouseMove(e: MouseEvent) {
        // Panning is handled by document-level listeners, so we don't need to handle it here
        // This function is mainly for node dragging and connection drawing
        
        if (isDragging && draggedNode && draggedNodeElement) {
            // Calculate new position using corrected offset
            const rect = canvasRef.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left - canvasPosition.x) / scale;
            const mouseY = (e.clientY - rect.top - canvasPosition.y) / scale;
            let newX = mouseX - dragOffset.x;
            let newY = mouseY - dragOffset.y;
            
            // Snap to grid if enabled
            if (snapToGrid) {
                const gridSize = 20;
                newX = Math.round(newX / gridSize) * gridSize;
                newY = Math.round(newY / gridSize) * gridSize;
            }
            
            const clampedX = Math.max(0, newX);
            const clampedY = Math.max(0, newY);
            
            // Only update if position actually changed (prevents unnecessary updates when mouse hasn't moved)
            const currentLeft = parseFloat(draggedNodeElement.style.left) || draggedNode.position.x;
            const currentTop = parseFloat(draggedNodeElement.style.top) || draggedNode.position.y;
            
            if (Math.abs(clampedX - currentLeft) < 0.1 && Math.abs(clampedY - currentTop) < 0.1) {
                return; // Position hasn't changed, skip update
            }
            
            // Update DOM immediately - no delay, no throttling, instant visual feedback
            // Use setProperty to ensure it persists and overrides reactive binding
            draggedNodeElement.style.setProperty('left', `${clampedX}px`);
            draggedNodeElement.style.setProperty('top', `${clampedY}px`);
            
            // Update store less frequently - only every 3-4 frames to avoid blocking
            // Skip store updates during active drag to prevent re-renders
            if (storeUpdateTimer === null) {
                storeUpdateTimer = requestAnimationFrame(() => {
                    workflowEditorStore.updateNode(draggedNode!.id, {
                        position: { x: clampedX, y: clampedY }
                    });
                    lastStoreUpdate = { x: clampedX, y: clampedY };
                    storeUpdateTimer = null;
                });
            }
            
            // Check if mouse is over delete zone for visual feedback
            if (deleteZoneRef) {
                const deleteZoneRect = deleteZoneRef.getBoundingClientRect();
                const isOver = e.clientX >= deleteZoneRect.left && 
                              e.clientX <= deleteZoneRect.right &&
                              e.clientY >= deleteZoneRect.top && 
                              e.clientY <= deleteZoneRect.bottom;
                isOverDeleteZone = isOver;
            }
        } else if (connectingFrom) {
            // Track mouse position when connecting
            const rect = canvasRef.getBoundingClientRect();
            const x = (e.clientX - rect.left - canvasPosition.x) / scale;
            const y = (e.clientY - rect.top - canvasPosition.y) / scale;
            connectingMousePos = { x, y };
        }
    }

    function handleMouseUp(e: MouseEvent) {
        if (isPanning) {
            // End panning
            isPanning = false;
            if (canvasRef) {
                canvasRef.style.cursor = isSpacePressed ? 'grab' : '';
            }
            return;
        }
        
        if (isDragging && draggedNode && draggedNodeElement) {
            // Cancel any pending store update animation frame
            if (storeUpdateTimer !== null) {
                cancelAnimationFrame(storeUpdateTimer);
                storeUpdateTimer = null;
            }
            
            // Get final position from DOM and update store immediately
            const finalX = parseFloat(draggedNodeElement.style.left) || draggedNode.position.x;
            const finalY = parseFloat(draggedNodeElement.style.top) || draggedNode.position.y;
            workflowEditorStore.updateNode(draggedNode.id, {
                position: { x: finalX, y: finalY }
            }, true); // Save history when drag ends
            lastStoreUpdate = { x: finalX, y: finalY };
            
            // Check if mouse is over delete zone when releasing
            if (deleteZoneRef && isOverDeleteZone) {
                workflowEditorStore.removeNode(draggedNode.id);
                toast.success('Node deleted');
            }
            // Restore transitions and clean up
            if (draggedNodeElement) {
                draggedNodeElement.style.transition = '';
                draggedNodeElement.style.willChange = 'auto';
            }
            isDragging = false;
            draggedNode = null;
            draggedNodeElement = null;
            isOverDeleteZone = false;
        } else if (connectingFrom && e.target === canvasRef) {
            // Cancel connection if clicking on canvas
            connectingFrom = null;
            connectingMousePos = null;
        }
    }
    
    function handleWheel(e: WheelEvent) {
        // Prevent default scrolling
        e.preventDefault();
        
        // Zoom with mouse wheel
        const rect = canvasRef.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Calculate zoom point in canvas coordinates
        const canvasX = (mouseX - canvasPosition.x) / scale;
        const canvasY = (mouseY - canvasPosition.y) / scale;
        
        // Calculate new scale
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newScale = Math.max(0.1, Math.min(3, scale * zoomFactor));
        
        // Adjust canvas position to zoom towards mouse cursor
        canvasPosition = {
            x: mouseX - canvasX * newScale,
            y: mouseY - canvasY * newScale
        };
        
        scale = newScale;
    }
    
    function handleKeyDown(e: KeyboardEvent) {
        // Prevent shortcuts when typing in inputs
        if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') {
            return;
        }

        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const ctrlKey = isMac ? e.metaKey : e.ctrlKey;
        
        // Save (Ctrl/Cmd + S)
        if (ctrlKey && e.key === 's') {
            e.preventDefault();
            handleSave();
            return;
        }

        // Undo (Ctrl/Cmd + Z)
        if (ctrlKey && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            handleUndo();
            return;
        }

        // Redo (Ctrl/Cmd + Shift + Z or Ctrl/Cmd + Y)
        if (ctrlKey && (e.shiftKey && e.key === 'z') || (!e.shiftKey && e.key === 'y')) {
            e.preventDefault();
            handleRedo();
            return;
        }

        // Fit view (Ctrl/Cmd + F)
        if (ctrlKey && e.key === 'f') {
            e.preventDefault();
            handleFitView();
            return;
        }

        // Delete selected node
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (workflowEditorStore.selectedNode) {
                e.preventDefault();
                handleDeleteSelected();
            }
            return;
        }

        // Help dialog (?)
        if (e.key === '?' && !ctrlKey) {
            e.preventDefault();
            showHelpDialog = !showHelpDialog;
            return;
        }

        // Track space key for panning
        if (e.key === ' ' && (e.target === canvasRef || (e.target as HTMLElement)?.closest('.workflow-canvas'))) {
            if (!isSpacePressed) {
                isSpacePressed = true;
                if (canvasRef && !isDragging) {
                    canvasRef.style.cursor = 'grab';
                }
            }
        }
    }
    
    function handleKeyUp(e: KeyboardEvent) {
        // Release space key
        if (e.key === ' ') {
            isSpacePressed = false;
            if (canvasRef && !isPanning) {
                canvasRef.style.cursor = '';
            }
        }
    }
    
    function handleContextMenu(e: MouseEvent) {
        // Prevent context menu on middle mouse button
        if (e.button === 1) {
            e.preventDefault();
        }
    }

    function handleDeleteZoneDragOver(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'move';
        }
        isOverDeleteZone = true;
    }

    function handleDeleteZoneDragLeave(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        // Only set to false if we're actually leaving the delete zone
        if (!deleteZoneRef.contains(e.relatedTarget as Node)) {
            isOverDeleteZone = false;
        }
    }

    function handleDeleteZoneDrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        
        let nodeToDelete: FlowNode | null = null;
        
        // Try to get node from dataTransfer (for HTML5 drag fallback)
        if (e.dataTransfer) {
            try {
                const dataStr = e.dataTransfer.getData('application/json');
                if (dataStr) {
                    const data = JSON.parse(dataStr);
                    if (data.nodeId) {
                        nodeToDelete = workflowEditorStore.nodes.find(n => n.id === data.nodeId) || null;
                    }
                }
            } catch (error) {
                console.error('Failed to parse drag data:', error);
            }
        }
        
        if (nodeToDelete) {
            workflowEditorStore.removeNode(nodeToDelete.id);
            toast.success('Node deleted');
        }
        
        isOverDeleteZone = false;
    }

    function handleNodeDelete(node: FlowNode, e: MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
            workflowEditorStore.removeNode(node.id);
        toast.success('Node deleted');
    }

    function handleConnectionStart(nodeId: string, e: MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        // Start connection from output handle (right side) - drag mode
        connectingFrom = nodeId;
        // Initialize mouse position for temporary line
        const rect = canvasRef.getBoundingClientRect();
        const x = (e.clientX - rect.left - canvasPosition.x) / scale;
        const y = (e.clientY - rect.top - canvasPosition.y) / scale;
        connectingMousePos = { x, y };
        
        // Add mouse move and up listeners for drag-and-drop
        const handleMove = (moveEvent: MouseEvent) => {
            const rect = canvasRef.getBoundingClientRect();
            const x = (moveEvent.clientX - rect.left - canvasPosition.x) / scale;
            const y = (moveEvent.clientY - rect.top - canvasPosition.y) / scale;
            connectingMousePos = { x, y };
        };
        
        const handleUp = (upEvent: MouseEvent) => {
            // Check if we're over an input handle
            const target = upEvent.target as HTMLElement;
            const inputHandle = target.closest('.connection-handle.input-handle');
            if (inputHandle) {
                const targetNodeId = inputHandle.getAttribute('data-node-id');
                if (targetNodeId && targetNodeId !== connectingFrom) {
                    completeConnection(targetNodeId);
                } else {
                    cancelConnection();
                }
            } else {
                cancelConnection();
            }
            
            document.removeEventListener('mousemove', handleMove);
            document.removeEventListener('mouseup', handleUp);
        };
        
        document.addEventListener('mousemove', handleMove);
        document.addEventListener('mouseup', handleUp);
    }

    function handleConnectionEnd(nodeId: string, e: MouseEvent) {
        e.stopPropagation();
        e.preventDefault();
        // End connection at input handle (left side) - complete the connection
        if (connectingFrom && connectingFrom !== nodeId) {
            completeConnection(nodeId);
        }
    }
    
    function completeConnection(targetNodeId: string) {
        if (!connectingFrom) return;
        
            const sourceNode = workflowEditorStore.nodes.find(n => n.id === connectingFrom);
        const targetNode = workflowEditorStore.nodes.find(n => n.id === targetNodeId);
            
            if (sourceNode && targetNode) {
                if (sourceNode.data.workflowNodeType === 'destination') {
                    alert('Destination nodes cannot have outgoing connections');
                cancelConnection();
                    return;
                }
                if (targetNode.data.workflowNodeType === 'source') {
                    alert('Source nodes cannot have incoming connections');
                cancelConnection();
                    return;
                }
                
                const existingEdge = workflowEditorStore.edges.find(
                e => e.source === connectingFrom && e.target === targetNodeId
                );
                
                if (!existingEdge) {
                    workflowEditorStore.addEdge({
                        source: connectingFrom,
                    target: targetNodeId
                });
                toast.success('Connection created');
            } else {
                toast.info('Connection already exists');
            }
        }
        cancelConnection();
    }
    
    function cancelConnection() {
        connectingFrom = null;
        connectingMousePos = null;
    }

    function getNodeColor(type: string): string {
        return NODE_COLORS[type as keyof typeof NODE_COLORS] || NODE_COLORS.processor;
    }

    function getEdgePath(edge: FlowEdge): string {
        const sourceNode = workflowEditorStore.nodes.find(n => n.id === edge.source);
        const targetNode = workflowEditorStore.nodes.find(n => n.id === edge.target);
        
        if (!sourceNode || !targetNode || !canvasRef) return '';

        // Get actual handle positions from DOM for accurate centering
        const sourceOutputHandle = canvasRef.querySelector(`[data-node-id="${edge.source}"] .output-handle`) as HTMLElement;
        const targetInputHandle = canvasRef.querySelector(`[data-node-id="${edge.target}"] .input-handle`) as HTMLElement;
        
        let x1: number, y1: number, x2: number, y2: number;
        
        // Try to use actual handle positions from DOM (most accurate)
        if (sourceOutputHandle && targetInputHandle) {
            const sourceHandleRect = sourceOutputHandle.getBoundingClientRect();
            const targetHandleRect = targetInputHandle.getBoundingClientRect();
            const canvasRect = canvasRef.getBoundingClientRect();
            
            // Verify handles have valid dimensions (not 0x0, which indicates not yet laid out)
            if (sourceHandleRect.width > 0 && sourceHandleRect.height > 0 && 
                targetHandleRect.width > 0 && targetHandleRect.height > 0) {
                // Convert to canvas coordinates (accounting for transform)
                x1 = (sourceHandleRect.left + sourceHandleRect.width / 2 - canvasRect.left - canvasPosition.x) / scale;
                y1 = (sourceHandleRect.top + sourceHandleRect.height / 2 - canvasRect.top - canvasPosition.y) / scale;
                x2 = (targetHandleRect.left + targetHandleRect.width / 2 - canvasRect.left - canvasPosition.x) / scale;
                y2 = (targetHandleRect.top + targetHandleRect.height / 2 - canvasRect.top - canvasPosition.y) / scale;
            } else {
                // Handles not yet laid out, use fallback
                return getEdgePathFallback(sourceNode, targetNode);
            }
        } else {
            // Handles not found, use fallback
            return getEdgePathFallback(sourceNode, targetNode);
        }
        
        // Calculate distance between nodes for curve control points
        const dx = x2 - x1;
        const curveOffset = Math.min(Math.abs(dx) * 0.5, 150); // Dynamic curve based on distance, max 150px
        
        // Create a smooth S-curve using cubic Bezier
        // Control points create horizontal curves that smooth into the connection points
        const cp1x = x1 + curveOffset;
        const cp1y = y1;
        const cp2x = x2 - curveOffset;
        const cp2y = y2;
        
        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    function getEdgePathFallback(sourceNode: FlowNode, targetNode: FlowNode): string {
        // Fallback: calculate from node positions
        // Connection handles: output at right-[-6px], input at left-[-6px]
        // Handle is 12px wide (w-3), so center is 6px from edge
        const nodeWidth = 200;
        const x1 = sourceNode.position.x + nodeWidth + 6; // right edge + 6px offset + 6px to center
        const x2 = targetNode.position.x - 6; // left edge - 6px offset - 6px to center
        
        // Get node heights for Y calculation
        // Use getBoundingClientRect for more accurate height calculation
        let y1: number, y2: number;
        
        if (canvasRef) {
            const sourceElement = canvasRef.querySelector(`[data-node-id="${sourceNode.id}"]`) as HTMLElement;
            const targetElement = canvasRef.querySelector(`[data-node-id="${targetNode.id}"]`) as HTMLElement;
            
            if (sourceElement && targetElement) {
                // Use getBoundingClientRect for accurate height (accounts for transforms)
                const sourceRect = sourceElement.getBoundingClientRect();
                const targetRect = targetElement.getBoundingClientRect();
                const canvasRect = canvasRef.getBoundingClientRect();
                
                // Convert heights to canvas coordinates
                const sourceHeight = sourceRect.height / scale;
                const targetHeight = targetRect.height / scale;
                
                y1 = sourceNode.position.y + (sourceHeight / 2);
                y2 = targetNode.position.y + (targetHeight / 2);
            } else {
                // Elements not found, use minimum height estimate
                y1 = sourceNode.position.y + 30;
                y2 = targetNode.position.y + 30;
            }
        } else {
            // Canvas not ready, use minimum height estimate
            y1 = sourceNode.position.y + 30;
            y2 = targetNode.position.y + 30;
        }
        
        // Calculate distance between nodes for curve control points
        const dx = x2 - x1;
        const curveOffset = Math.min(Math.abs(dx) * 0.5, 150);
        
        // Create a smooth S-curve using cubic Bezier
        const cp1x = x1 + curveOffset;
        const cp1y = y1;
        const cp2x = x2 - curveOffset;
        const cp2y = y2;
        
        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    function getTemporaryConnectionPath(): string {
        if (!connectingFrom || !connectingMousePos || !canvasRef) return '';
        
        const sourceNode = workflowEditorStore.nodes.find(n => n.id === connectingFrom);
        if (!sourceNode) return '';
        
        // Get actual handle position from DOM for accurate centering
        const sourceOutputHandle = canvasRef.querySelector(`[data-node-id="${connectingFrom}"] .output-handle`) as HTMLElement;
        
        let x1: number, y1: number;
        
        if (sourceOutputHandle) {
            // Get handle position in canvas coordinates
            const sourceHandleRect = sourceOutputHandle.getBoundingClientRect();
            const canvasRect = canvasRef.getBoundingClientRect();
            
            // Convert to canvas coordinates (accounting for transform)
            x1 = (sourceHandleRect.left + sourceHandleRect.width / 2 - canvasRect.left - canvasPosition.x) / scale;
            y1 = (sourceHandleRect.top + sourceHandleRect.height / 2 - canvasRect.top - canvasPosition.y) / scale;
        } else {
            // Fallback: calculate from node position
            const nodeWidth = 200;
            x1 = sourceNode.position.x + nodeWidth + 6;
            
            const sourceElement = canvasRef.querySelector(`[data-node-id="${connectingFrom}"]`) as HTMLElement;
            if (sourceElement) {
                y1 = sourceNode.position.y + (sourceElement.offsetHeight / 2);
            } else {
                y1 = sourceNode.position.y + 30;
            }
        }
        
        // End at mouse position
        const x2 = connectingMousePos.x;
        const y2 = connectingMousePos.y;
        
        // Calculate distance for curve control points
        const dx = x2 - x1;
        const dy = y2 - y1;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const curveOffset = Math.min(distance * 0.4, 100); // Dynamic curve, max 100px
        
        // Create a smooth curve using cubic Bezier
        const cp1x = x1 + curveOffset;
        const cp1y = y1;
        const cp2x = x2 - curveOffset;
        const cp2y = y2;
        
        return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
    }

    async function handleSave() {
        const success = await workflowEditorStore.save();
        if (success) {
            toast.success('Workflow saved successfully');
        } else {
            const errorMessage = workflowEditorStore.error || 'Failed to save workflow';
            toast.error(errorMessage);
            console.error('Save failed:', errorMessage);
        }
    }


    function handleUndo() {
        workflowEditorStore.undo();
    }

    function handleRedo() {
        workflowEditorStore.redo();
    }

    function handleDeleteSelected() {
        if (workflowEditorStore.selectedNode) {
            workflowEditorStore.removeNode(workflowEditorStore.selectedNode.id);
            toast.success('Node deleted');
        }
    }

    function handleZoomIn() {
        scale = Math.min(scale + 0.1, 2);
    }

    function handleZoomOut() {
        scale = Math.max(scale - 0.1, 0.5);
    }

    function handleFitView() {
        if (workflowEditorStore.nodes.length === 0) return;
        
        const minX = Math.min(...workflowEditorStore.nodes.map(n => n.position.x));
        const minY = Math.min(...workflowEditorStore.nodes.map(n => n.position.y));
        const maxX = Math.max(...workflowEditorStore.nodes.map(n => n.position.x + 200));
        const maxY = Math.max(...workflowEditorStore.nodes.map(n => n.position.y + 60));
        
        const width = maxX - minX;
        const height = maxY - minY;
        const canvasWidth = canvasRef.clientWidth;
        const canvasHeight = canvasRef.clientHeight;
        
        scale = Math.min(canvasWidth / width, canvasHeight / height, 1) * 0.9;
        canvasPosition = {
            x: (canvasWidth - width * scale) / 2 - minX * scale,
            y: (canvasHeight - height * scale) / 2 - minY * scale
        };
    }

    function handleDragOver(e: DragEvent) {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = 'copy';
        }
    }

    function handleDrop(e: DragEvent) {
        e.preventDefault();
        e.stopPropagation();
        
        if (!e.dataTransfer) return;
        
        try {
            const dataStr = e.dataTransfer.getData('application/json');
            if (!dataStr) return;
            
            const data = JSON.parse(dataStr);
            if (!data.connectorId) return;
            
            const rect = canvasRef.getBoundingClientRect();
            const x = (e.clientX - rect.left - canvasPosition.x) / scale;
            const y = (e.clientY - rect.top - canvasPosition.y) / scale;
            
            workflowEditorStore.addNode({
                connectorId: data.connectorId,
                position: { x: Math.max(0, x - 100), y: Math.max(0, y - 30) }
            });
            
            toast.success(`Added ${data.connectorName || data.connectorId} node`);
        } catch (error) {
            console.error('Failed to handle drop:', error);
            toast.error('Failed to add node');
        }
    }

    function getNodeConnectionCounts(nodeId: string) {
        return workflowEditorStore.getNodeConnectionCounts(nodeId);
    }

    function isNodeConfigured(nodeId: string) {
        return workflowEditorStore.isNodeConfigured(nodeId);
    }
</script>

<div class="h-full flex flex-col">
    <!-- Toolbar -->
    <div class="flex items-center justify-between px-4 py-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <!-- Left Section: Actions -->
        <div class="flex items-center gap-2">
            <Button 
                variant="outline" 
                size="sm" 
                onclick={handleSave} 
                disabled={!workflowEditorStore.isDirty || workflowEditorStore.isLoading}
                class="hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Save (Ctrl/Cmd + S)"
            >
                <Save class="h-4 w-4 mr-2" />
                Save
            </Button>
        </div>

        <!-- Right Section: View Options -->
        <div class="flex items-center gap-1 ml-4">
            <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 hover:bg-accent transition-colors {showGrid ? 'bg-accent' : ''}"
                onclick={() => showGrid = !showGrid}
                title="Toggle grid"
            >
                <Grid3x3 class="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                class="h-8 w-8 hover:bg-accent transition-colors {showMinimap ? 'bg-accent' : ''}"
                onclick={() => showMinimap = !showMinimap}
                title="Toggle minimap"
            >
                <Map class="h-4 w-4" />
            </Button>
            <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild let:builder>
                    <Button variant="ghost" size="icon" class="h-8 w-8 hover:bg-accent transition-colors" builders={[builder]} title="More options">
                        <MoreVertical class="h-4 w-4" />
                    </Button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Content>
                    <DropdownMenu.Item onclick={handleUndo} disabled={!workflowEditorStore.canUndo}>
                        <Undo2 class="h-4 w-4 mr-2" />
                        Undo
                        <span class="ml-auto text-xs text-muted-foreground">Ctrl+Z</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Item onclick={handleRedo} disabled={!workflowEditorStore.canRedo}>
                        <Redo2 class="h-4 w-4 mr-2" />
                        Redo
                        <span class="ml-auto text-xs text-muted-foreground">Ctrl+Shift+Z</span>
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item onclick={() => snapToGrid = !snapToGrid}>
                        <Grid3x3 class="h-4 w-4 mr-2" />
                        {snapToGrid ? 'Disable' : 'Enable'} Snap to Grid
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item onclick={() => showHelpDialog = true}>
                        <HelpCircle class="h-4 w-4 mr-2" />
                        Keyboard Shortcuts
                        <span class="ml-auto text-xs text-muted-foreground">?</span>
                    </DropdownMenu.Item>
                </DropdownMenu.Content>
            </DropdownMenu.Root>
        </div>
    </div>

    <!-- Canvas Area -->
    <div class="relative overflow-hidden flex-1 min-h-0 flex flex-col h-full w-full">
        <div
            bind:this={canvasRef}
            class="absolute inset-0 w-full h-full bg-background select-none workflow-canvas"
            style="background-image: {showGrid ? 'linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)' : 'none'}; background-size: 20px 20px; cursor: {isSpacePressed ? 'grab' : 'default'};"
            role="region"
            aria-label="Workflow canvas"
            onmousedown={handleCanvasMouseDown}
            onmousemove={handleMouseMove}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseUp}
            onwheel={handleWheel}
            oncontextmenu={handleContextMenu}
            ondragover={handleDragOver}
            ondrop={handleDrop}
            tabindex="0"
        >
            <svg class="absolute top-0 left-0 pointer-events-none" style="width: 100%; height: 100%; overflow: visible; transform: translate({canvasPosition.x}px, {canvasPosition.y}px) scale({scale}); transform-origin: 0 0;">
                {#each workflowEditorStore.edges as edge (edge.id)}
                    <!-- edgeRecalcKey forces recalculation when nodes are loaded -->
                    {@const _ = edgeRecalcKey}
                    {@const path = getEdgePath(edge)}
                    {#if path}
                        <path
                            class="animated-edge"
                            d={path}
                            stroke="hsl(var(--foreground))"
                            stroke-width="2"
                            fill="none"
                            marker-end="url(#arrowhead)"
                        />
                    {/if}
                {/each}
                {#if connectingFrom && connectingMousePos}
                    <path
                        d={getTemporaryConnectionPath()}
                        stroke="hsl(var(--primary))"
                        stroke-width="2"
                        stroke-dasharray="5 5"
                        fill="none"
                        opacity="0.6"
                    />
                {/if}
                <defs>
                    <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
                        <polygon points="0 0, 10 3, 0 6" fill="hsl(var(--foreground))" />
                    </marker>
                </defs>
            </svg>
            <div
                class="absolute top-0 left-0 w-full h-full select-none"
                style="transform: translate({canvasPosition.x}px, {canvasPosition.y}px) scale({scale}); transform-origin: 0 0;"
            >
                {#each workflowEditorStore.nodes as node}
                    {@const connectionCounts = getNodeConnectionCounts(node.id)}
                    {@const configured = isNodeConfigured(node.id)}
                    <div
                        data-node-id={node.id}
                        class="absolute w-[200px] min-h-[60px] bg-card border-2 rounded-lg p-2 cursor-move shadow-sm hover:shadow-md hover:z-10 select-none {workflowEditorStore.selectedNode?.id === node.id ? 'border-[3px] shadow-[0_0_0_2px_hsl(var(--primary)/0.2)]' : ''} {isDragging && draggedNode?.id === node.id ? '' : 'transition-all'}"
                        style="left: {node.position.x}px; top: {node.position.y}px; border-color: {getNodeColor(node.data.workflowNodeType)}"
                        onmousedown={(e) => handleNodeMouseDown(node, e)}
                        role="button"
                        tabindex="0"
                    >
                        <div class="flex items-center gap-1.5 mb-1 group">
                            <div class="w-3 h-3 rounded-full flex-shrink-0" style="background-color: {getNodeColor(node.data.workflowNodeType)}"></div>
                            <span class="text-xs font-semibold flex-1 overflow-hidden text-ellipsis whitespace-nowrap">{node.data.label}</span>
                            <Button
                                variant="ghost"
                                size="icon"
                                class="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground"
                                onclick={(e) => handleNodeDelete(node, e)}
                                title="Delete node"
                            >
                                <Trash2 class="h-3 w-3" />
                            </Button>
                        </div>
                        <div class="text-[11px] text-muted-foreground">
                            <div class="text-xs text-muted-foreground mb-1">{node.data.nodeType}</div>
                            {#if node.data.config?.collection}
                                <div class="text-[10px] text-muted-foreground mb-1 truncate" title="Collection: {node.data.config.collection}">
                                    Collection: {node.data.config.collection}
                                </div>
                            {/if}
                            <div class="flex items-center gap-2 text-xs mt-1">
                                {#if node.data.workflowNodeType !== 'source'}
                                    <div class="flex items-center gap-1 text-muted-foreground">
                                        <ArrowLeft class="h-3 w-3" />
                                        <span>{connectionCounts.incoming}</span>
                                    </div>
                                {/if}
                                {#if node.data.workflowNodeType !== 'destination'}
                                    <div class="flex items-center gap-1 text-muted-foreground">
                                        <ArrowRight class="h-3 w-3" />
                                        <span>{connectionCounts.outgoing}</span>
                                    </div>
                                {/if}
                                <div class="flex items-center gap-1 ml-auto {configured ? 'text-green-600' : 'text-amber-600'}">
                                    {#if configured}
                                        <CheckCircle2 class="h-3 w-3" />
                                    {:else}
                                        <AlertCircle class="h-3 w-3" />
                                    {/if}
                                </div>
                            </div>
                        </div>
                        {#if node.data.workflowNodeType !== 'source'}
                            <div
                                class="absolute w-3 h-3 bg-background border-2 border-border rounded-full cursor-crosshair z-20 left-[-6px] top-1/2 -translate-y-1/2 hover:bg-primary hover:border-primary connection-handle input-handle"
                                data-node-id={node.id}
                                role="button"
                                tabindex="0"
                                aria-label="Input connection handle"
                                onmousedown={(e) => handleConnectionEnd(node.id, e)}
                            ></div>
                        {/if}
                        {#if node.data.workflowNodeType !== 'destination'}
                            <div
                                class="absolute w-3 h-3 bg-background border-2 border-border rounded-full cursor-crosshair z-20 right-[-6px] top-1/2 -translate-y-1/2 hover:bg-primary hover:border-primary connection-handle output-handle"
                                data-node-id={node.id}
                                role="button"
                                tabindex="0"
                                aria-label="Output connection handle"
                                onmousedown={(e) => handleConnectionStart(node.id, e)}
                            ></div>
                        {/if}
                    </div>
                {/each}
            </div>
            <!-- Delete Zone -->
            <div
                bind:this={deleteZoneRef}
                class="absolute bottom-4 left-1/2 -translate-x-1/2 w-[300px] h-32 bg-destructive/10 border-2 border-dashed border-destructive/50 rounded-lg flex flex-col items-center justify-center gap-2 opacity-0 pointer-events-none transition-all z-[100] delete-zone {isOverDeleteZone ? 'active' : ''} {isDragging ? 'visible' : ''}"
                role="region"
                aria-label="Delete zone"
                ondragover={handleDeleteZoneDragOver}
                ondragleave={handleDeleteZoneDragLeave}
                ondrop={handleDeleteZoneDrop}
            >
                <Trash2 class="h-8 w-8" />
                <span class="text-sm font-medium">Drop here to delete</span>
            </div>

            <!-- Zoom Controls (Bottom Left) -->
            <div class="absolute bottom-4 left-4 flex items-center gap-1 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border rounded-lg shadow-lg p-1 z-50">
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 hover:bg-accent transition-colors"
                    onclick={handleZoomOut}
                    title="Zoom out"
                >
                    <ZoomOut class="h-4 w-4" />
                </Button>
                <span class="text-xs font-medium px-2 min-w-[3rem] text-center">{Math.round(scale * 100)}%</span>
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 hover:bg-accent transition-colors"
                    onclick={handleZoomIn}
                    title="Zoom in"
                >
                    <ZoomIn class="h-4 w-4" />
                </Button>
                <div class="h-6 w-px bg-border mx-1"></div>
                <Button
                    variant="ghost"
                    size="icon"
                    class="h-8 w-8 hover:bg-accent transition-colors"
                    onclick={handleFitView}
                    title="Fit view (Ctrl/Cmd + F)"
                >
                    <Maximize2 class="h-4 w-4" />
                </Button>
            </div>
        </div>
    </div>

    <!-- Help Dialog -->
    {#if showHelpDialog}
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={() => showHelpDialog = false} role="dialog" aria-modal="true">
            <div class="bg-background border rounded-lg shadow-lg p-6 max-w-md w-full mx-4" onclick={(e) => e.stopPropagation()}>
                <div class="flex items-center justify-between mb-4">
                    <h3 class="text-lg font-semibold">Keyboard Shortcuts</h3>
                    <Button variant="ghost" size="icon" class="h-6 w-6" onclick={() => showHelpDialog = false}>
                        <X class="h-4 w-4" />
                    </Button>
                </div>
                <div class="space-y-2 text-sm">
                    <div class="flex items-center justify-between py-2 border-b">
                        <span class="text-muted-foreground">Pan canvas</span>
                        <kbd class="px-2 py-1 bg-muted rounded text-xs">Space</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 border-b">
                        <span class="text-muted-foreground">Save workflow</span>
                        <kbd class="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + S</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 border-b">
                        <span class="text-muted-foreground">Undo</span>
                        <kbd class="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + Z</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 border-b">
                        <span class="text-muted-foreground">Redo</span>
                        <kbd class="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + Shift + Z</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 border-b">
                        <span class="text-muted-foreground">Fit view</span>
                        <kbd class="px-2 py-1 bg-muted rounded text-xs">Ctrl/Cmd + F</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2 border-b">
                        <span class="text-muted-foreground">Delete node</span>
                        <kbd class="px-2 py-1 bg-muted rounded text-xs">Delete / Backspace</kbd>
                    </div>
                    <div class="flex items-center justify-between py-2">
                        <span class="text-muted-foreground">Show shortcuts</span>
                        <kbd class="px-2 py-1 bg-muted rounded text-xs">?</kbd>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>

<style>
    .workflow-canvas:active {
        cursor: grabbing;
    }
    
    .workflow-canvas:focus {
        outline: none;
    }
    
    .workflow-canvas svg {
        overflow: visible !important;
    }

    @keyframes dash-flow {
        to {
            stroke-dashoffset: -10;
        }
    }

    .animated-edge {
        stroke-dasharray: 5 5;
        animation: dash-flow 0.5s linear infinite;
    }

    .delete-zone.visible {
        opacity: 0.3;
        pointer-events: all;
    }

    .delete-zone.active {
        opacity: 1;
        pointer-events: all;
        background: hsl(var(--destructive) / 0.2);
        border-color: hsl(var(--destructive));
    }

    .delete-zone.active svg {
        color: hsl(var(--destructive));
        animation: pulse 1s ease-in-out infinite;
    }

    @keyframes pulse {
        0%, 100% {
            transform: scale(1);
        }
        50% {
            transform: scale(1.1);
        }
    }
</style>

