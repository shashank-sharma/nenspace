<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import * as d3 from 'd3'
  import { graphStore, notesStore, vaultStore } from '../stores'
  import { markdownService } from '../services'
  import type { GraphNode, GraphEdge } from '../types'

  let svgElement: SVGElement
  let width = $state(800)
  let height = $state(600)

  let simulation: d3.Simulation<GraphNode, undefined> | null = null
  let nodes: GraphNode[] = []
  let edges: GraphEdge[] = []

  onMount(async () => {
    if (!vaultStore.activeVault) return

    await buildGraph()
    initializeSimulation()

    const resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        width = entry.contentRect.width
        height = entry.contentRect.height
        if (simulation) {
          simulation.force('center', d3.forceCenter(width / 2, height / 2))
        }
      }
    })

    if (svgElement?.parentElement) {
      resizeObserver.observe(svgElement.parentElement)
    }

    return () => {
      resizeObserver.disconnect()
      if (simulation) simulation.stop()
    }
  })

  onDestroy(() => {
    if (simulation) simulation.stop()
  })

  async function buildGraph() {
    if (!vaultStore.activeVault) return

    const linkIndex = markdownService.getLinkIndex(vaultStore.activeVault.id)
    await linkIndex.buildIndex()

    const allNotes = notesStore.notes
    const nodeMap = new Map<string, GraphNode>()

    for (const note of allNotes) {
      const outgoing = linkIndex.getOutgoingLinks(note.path)
      const backlinks = linkIndex.getBacklinks(note.path)

      const node: GraphNode = {
        id: note.id,
        label: note.title,
        path: note.path,
        linkCount: outgoing.length + backlinks.length,
        outgoingCount: outgoing.length,
        incomingCount: backlinks.length,
        isOrphan: outgoing.length === 0 && backlinks.length === 0,
        isCurrent: note.path === notesStore.activeNote?.path
      }

      nodeMap.set(note.id, node)
    }

    nodes = Array.from(nodeMap.values())

    const edgeMap = new Map<string, GraphEdge>()

    for (const note of allNotes) {
      const outgoing = linkIndex.getOutgoingLinks(note.path)

      for (const link of outgoing) {
        if (link.resolved && link.targetNoteId) {
          const targetNote = allNotes.find(n => n.id === link.targetNoteId)
          if (targetNote) {
            const edgeId = `${note.id}-${targetNote.id}`
            if (!edgeMap.has(edgeId)) {
              edgeMap.set(edgeId, {
                id: edgeId,
                source: note.id,
                target: targetNote.id,
                type: link.type,
                weight: 1
              })
            } else {
              edgeMap.get(edgeId)!.weight++
            }
          }
        }
      }
    }

    edges = Array.from(edgeMap.values())

    if (!graphStore.settings.showOrphans) {
      nodes = nodes.filter(n => !n.isOrphan)
    }

    graphStore.setData({ nodes, edges })
  }

  function initializeSimulation() {
    if (!svgElement) return

    const svg = d3.select(svgElement)
    svg.selectAll('*').remove()

    const g = svg.append('g')

    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform.toString())
      })

    svg.call(zoomBehavior as any)

    const link = g.append('g')
      .selectAll('line')
      .data(edges)
      .enter()
      .append('line')
      .attr('stroke', '#999')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.sqrt(d.weight))

    const node = g.append('g')
      .selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', (d) => {
        if (graphStore.settings.nodeSize === 'uniform') return 5
        return Math.max(3, Math.min(10, Math.sqrt(d.linkCount) * 2))
      })
      .attr('fill', (d) => {
        if (d.isCurrent) return '#7c3aed'
        if (d.isOrphan) return '#999'
        return '#3b82f6'
      })
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (_, d) => handleNodeClick(d))
      .call(d3.drag<SVGCircleElement, GraphNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any
      )

    const label = g.append('g')
      .selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .text((d) => d.label)
      .attr('font-size', '10px')
      .attr('dx', 12)
      .attr('dy', 4)
      .style('pointer-events', 'none')

    simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(edges).id((d: any) => d.id).distance(graphStore.settings.linkDistance))
      .force('charge', d3.forceManyBody().strength(graphStore.settings.chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y)

      node
        .attr('cx', (d: any) => d.x)
        .attr('cy', (d: any) => d.y)

      label
        .attr('x', (d: any) => d.x)
        .attr('y', (d: any) => d.y)
    })
  }

  function dragstarted(event: any) {
    if (!event.active && simulation) simulation.alphaTarget(0.3).restart()
    event.subject.fx = event.subject.x
    event.subject.fy = event.subject.y
  }

  function dragged(event: any) {
    event.subject.fx = event.x
    event.subject.fy = event.y
  }

  function dragended(event: any) {
    if (!event.active && simulation) simulation.alphaTarget(0)
    event.subject.fx = null
    event.subject.fy = null
  }

  async function handleNodeClick(node: GraphNode) {
    if (!vaultStore.activeVault) return
    await notesStore.loadNote(vaultStore.activeVault.id, node.path)
  }

  $effect(() => {
    if (notesStore.activeNote) {
      buildGraph()
    }
  })
</script>

<div class="graph-view h-full w-full">
  <svg bind:this={svgElement} width={width} height={height} class="w-full h-full"></svg>
</div>

<style>
  .graph-view {
    background: hsl(var(--background));
  }
</style>

