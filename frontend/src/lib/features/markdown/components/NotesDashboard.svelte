<script lang="ts">
  import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '$lib/components/ui/card'
  import { Badge } from '$lib/components/ui/badge'
  import { notesStore, vaultStore, workspaceStore } from '../stores'
  import { UsageAreaChart, UsageBarChart } from '$lib/components/charts'
  import type { ChartConfig } from '$lib/components/ui/chart'
  import {
    FileText,
    Star,
    TrendingUp,
    Hash,
    Calendar,
    Folder,
    Link as LinkIcon,
    BookOpen,
    Clock,
    Tag,
    BarChart3
  } from 'lucide-svelte'
  import { DateUtil } from '$lib/utils'

  const notes = $derived(notesStore.notes)
  const activeVault = $derived(vaultStore.activeVault)

  async function handleNoteClick(notePath: string) {
    if (!activeVault) return
    const note = await notesStore.loadNote(activeVault.id, notePath)
    if (note) {
      workspaceStore.createTab(note.id, note.path, activeVault.id)
    }
  }

  const stats = $derived(() => {
    if (!notes.length) return null

    const totalNotes = notes.length
    const totalWords = notes.reduce((sum, n) => sum + (n.wordCount || 0), 0)
    const starredNotes = notes.filter(n => n.isStarred).length
    const templates = notes.filter(n => n.isTemplate).length
    const totalLinks = notes.reduce((sum, n) => sum + (n.linkCount || 0), 0)
    const totalBacklinks = notes.reduce((sum, n) => sum + (n.backlinkCount || 0), 0)
    const avgWordCount = totalNotes > 0 ? Math.round(totalWords / totalNotes) : 0

    const allTags = notes.flatMap(n => n.tags || [])
    const tagCounts = new Map<string, number>()
    allTags.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })
    const topTags = Array.from(tagCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([tag, count]) => ({ tag, count }))

    const now = new Date()
    const last7Days = notes.filter(n => {
      const daysSinceUpdate = Math.floor((now.getTime() - n.updated.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceUpdate <= 7
    }).length

    const last30Days = notes.filter(n => {
      const daysSinceUpdate = Math.floor((now.getTime() - n.updated.getTime()) / (1000 * 60 * 60 * 24))
      return daysSinceUpdate <= 30
    }).length

    const recentNotes = [...notes]
      .sort((a, b) => b.updated.getTime() - a.updated.getTime())
      .slice(0, 5)

    const mostLinkedNotes = [...notes]
      .sort((a, b) => (b.linkCount || 0) - (a.linkCount || 0))
      .slice(0, 5)

    const notesByMonth = new Map<string, number>()
    notes.forEach(note => {
      const monthKey = `${note.created.getFullYear()}-${String(note.created.getMonth() + 1).padStart(2, '0')}`
      notesByMonth.set(monthKey, (notesByMonth.get(monthKey) || 0) + 1)
    })

    const creationData = Array.from(notesByMonth.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-12)
      .map(([month, count]) => ({
        month: new Date(month + '-01').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        notes: count
      }))

    const linkData = mostLinkedNotes.map(note => ({
      name: note.title.length > 20 ? note.title.substring(0, 20) + '...' : note.title,
      links: note.linkCount || 0
    }))

    const tagData = topTags.map(({ tag, count }) => ({
      name: tag.length > 15 ? tag.substring(0, 15) + '...' : tag,
      count
    }))

    return {
      totalNotes,
      totalWords,
      starredNotes,
      templates,
      totalLinks,
      totalBacklinks,
      avgWordCount,
      topTags,
      last7Days,
      last30Days,
      recentNotes,
      mostLinkedNotes,
      creationData,
      linkData,
      tagData
    }
  })

  const creationChartConfig: ChartConfig = {
    notes: {
      label: 'Notes Created',
      color: 'hsl(var(--chart-1))'
    }
  }

  const linkChartConfig: ChartConfig = {
    links: {
      label: 'Links',
      color: 'hsl(var(--chart-2))'
    }
  }

  const tagChartConfig: ChartConfig = {
    count: {
      label: 'Usage',
      color: 'hsl(var(--chart-3))'
    }
  }
</script>

{#if !activeVault}
  <div class="h-full flex items-center justify-center text-muted-foreground">
    <p>No vault selected</p>
  </div>
{:else if !notes.length}
  <div class="h-full flex items-center justify-center text-muted-foreground">
    <div class="text-center space-y-2">
      <FileText class="h-12 w-12 mx-auto opacity-50" />
      <p>No notes yet</p>
      <p class="text-sm">Create your first note to get started</p>
    </div>
  </div>
{:else if stats()}
  {@const statsData = stats()!}
  <div class="h-full w-full overflow-auto px-6 pb-6 pt-0">
    <div class="space-y-6 w-full">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Total Notes</CardTitle>
            <FileText class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{statsData.totalNotes}</div>
            <p class="text-xs text-muted-foreground mt-1">
              {statsData.templates > 0 ? `${statsData.templates} templates` : 'All notes'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Total Words</CardTitle>
            <BookOpen class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{statsData.totalWords.toLocaleString()}</div>
            <p class="text-xs text-muted-foreground mt-1">
              Avg {statsData.avgWordCount.toLocaleString()} words/note
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Starred Notes</CardTitle>
            <Star class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{statsData.starredNotes}</div>
            <p class="text-xs text-muted-foreground mt-1">
              {statsData.starredNotes > 0 ? 'Important notes' : 'No starred notes'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle class="text-sm font-medium">Total Links</CardTitle>
            <LinkIcon class="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div class="text-2xl font-bold">{statsData.totalLinks}</div>
            <p class="text-xs text-muted-foreground mt-1">
              {statsData.totalBacklinks} backlinks
            </p>
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <TrendingUp class="h-5 w-5" />
              Notes Created Over Time
            </CardTitle>
            <CardDescription>Last 12 months</CardDescription>
          </CardHeader>
          <CardContent>
            {#if statsData.creationData.length > 0}
              <UsageAreaChart
                data={statsData.creationData}
                config={creationChartConfig}
                xKey="month"
                yKeys={['notes']}
                height={200}
              />
            {:else}
              <div class="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No creation data available
              </div>
            {/if}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Hash class="h-5 w-5" />
              Most Used Tags
            </CardTitle>
            <CardDescription>Top 10 tags by usage</CardDescription>
          </CardHeader>
          <CardContent>
            {#if statsData.tagData.length > 0}
              <UsageBarChart
                data={statsData.tagData}
                config={tagChartConfig}
                xKey="name"
                yKeys={['count']}
                height={200}
              />
            {:else}
              <div class="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No tags found
              </div>
            {/if}
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <LinkIcon class="h-5 w-5" />
              Most Linked Notes
            </CardTitle>
            <CardDescription>Notes with the most outgoing links</CardDescription>
          </CardHeader>
          <CardContent>
            {#if statsData.linkData.length > 0}
              <UsageBarChart
                data={statsData.linkData}
                config={linkChartConfig}
                xKey="name"
                yKeys={['links']}
                height={200}
              />
            {:else}
              <div class="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
                No links found
              </div>
            {/if}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Clock class="h-5 w-5" />
              Recent Activity
            </CardTitle>
            <CardDescription>Recently updated notes</CardDescription>
          </CardHeader>
          <CardContent>
            <div class="space-y-3">
              {#each statsData.recentNotes as note}
                <div
                  class="flex items-center justify-between p-2 rounded hover:bg-accent transition-colors cursor-pointer"
                  on:click={() => handleNoteClick(note.path)}
                  role="button"
                  tabindex="0"
                  on:keydown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      handleNoteClick(note.path)
                    }
                  }}
                >
                  <div class="flex items-center gap-2 flex-1 min-w-0">
                    <FileText class="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div class="flex-1 min-w-0">
                      <p class="text-sm font-medium truncate">{note.title}</p>
                      <p class="text-xs text-muted-foreground">
                        Updated {DateUtil.formatRelative(note.updated, { includeTime: true })}
                      </p>
                    </div>
                  </div>
                  {#if note.isStarred}
                    <Star class="h-4 w-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                  {/if}
                </div>
              {/each}
            </div>
          </CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Calendar class="h-5 w-5" />
              Activity Summary
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">Updated last 7 days</span>
              <span class="text-sm font-semibold">{statsData.last7Days}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">Updated last 30 days</span>
              <span class="text-sm font-semibold">{statsData.last30Days}</span>
            </div>
            <div class="flex items-center justify-between">
              <span class="text-sm text-muted-foreground">Templates</span>
              <span class="text-sm font-semibold">{statsData.templates}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <Tag class="h-5 w-5" />
              Top Tags
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div class="flex flex-wrap gap-2">
              {#each statsData.topTags.slice(0, 8) as { tag, count }}
                <Badge variant="secondary" class="text-xs">
                  #{tag} <span class="text-muted-foreground ml-1">({count})</span>
                </Badge>
              {/each}
            </div>
            {#if statsData.topTags.length === 0}
              <p class="text-sm text-muted-foreground">No tags yet</p>
            {/if}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle class="flex items-center gap-2">
              <BarChart3 class="h-5 w-5" />
              Quick Stats
            </CardTitle>
          </CardHeader>
          <CardContent class="space-y-3">
            <div>
              <p class="text-xs text-muted-foreground mb-1">Average note length</p>
              <p class="text-lg font-semibold">{statsData.avgWordCount.toLocaleString()} words</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground mb-1">Total connections</p>
              <p class="text-lg font-semibold">{statsData.totalLinks + statsData.totalBacklinks}</p>
            </div>
            <div>
              <p class="text-xs text-muted-foreground mb-1">Link density</p>
              <p class="text-lg font-semibold">
                {statsData.totalNotes > 0 ? ((statsData.totalLinks / statsData.totalNotes) * 100).toFixed(1) : '0'}%
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  </div>
{/if}

