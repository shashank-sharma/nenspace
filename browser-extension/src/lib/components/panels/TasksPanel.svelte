<script lang="ts">
  import TaskCard from "../TaskCard.svelte"
  import SharedEmptyState from "../shared/SharedEmptyState.svelte"
  import SharedLoadingState from "../shared/SharedLoadingState.svelte"

  // Demo tasks showcasing the color scheme
  let tasks = [
    {
      id: 1,
      title: "Implement user authentication flow",
      deadline: "Today, 3:00 PM",
      completed: false,
      inProgress: true,
      category: 'backend' as const
    },
    {
      id: 2,
      title: "Design dashboard component",
      deadline: "Tomorrow, 10:00 AM",
      completed: false,
      inProgress: false,
      category: 'frontend' as const
    },
    {
      id: 3,
      title: "Set up database schema",
      deadline: "Yesterday",
      completed: true,
      inProgress: false,
      category: 'backend' as const
    },
    {
      id: 4,
      title: "Write API documentation",
      deadline: "Friday, 2:00 PM",
      completed: false,
      inProgress: false,
      category: 'default' as const
    },
    {
      id: 5,
      title: "Create command palette UI",
      deadline: "Last week",
      completed: true,
      inProgress: false,
      category: 'frontend' as const
    }
  ]

  function toggleTask(taskId: number) {
    tasks = tasks.map(task => 
      task.id === taskId 
        ? { ...task, completed: !task.completed, inProgress: false }
        : task
    )
  }
</script>

<div class="tasks-panel">
  <div class="header">
    <h2>Tasks</h2>
    <p class="subtitle">Your project tasks organized by category</p>
  </div>

  <div class="legend">
    <div class="legend-item">
      <div class="indicator backend"></div>
      <span>Backend</span>
    </div>
    <div class="legend-item">
      <div class="indicator frontend"></div>
      <span>Frontend</span>
    </div>
    <div class="legend-item">
      <div class="indicator in-progress"></div>
      <span>In Progress</span>
    </div>
  </div>

  <div class="tasks-list">
    {#each tasks as task (task.id)}
      <TaskCard
        title={task.title}
        deadline={task.deadline}
        completed={task.completed}
        inProgress={task.inProgress}
        category={task.category}
        onToggle={() => toggleTask(task.id)}
      />
    {/each}
  </div>

  <div class="stats">
    <div class="stat">
      <span class="stat-value">{tasks.filter(t => t.completed).length}</span>
      <span class="stat-label">Completed</span>
    </div>
    <div class="stat">
      <span class="stat-value">{tasks.filter(t => t.inProgress).length}</span>
      <span class="stat-label">In Progress</span>
    </div>
    <div class="stat">
      <span class="stat-value">{tasks.filter(t => !t.completed && !t.inProgress).length}</span>
      <span class="stat-label">Pending</span>
    </div>
  </div>
</div>

<!-- 
  CRITICAL: NO CSS in <style> tags for CSUI child components!
  All styles are injected via getStyle API into Shadow DOM ONLY.
  This prevents CSS from leaking to the page.
  
  Styles are defined in: src/lib/utils/csui-child-components-styles.util.ts
  Function: getTasksPanelStyles()
-->

<style>
  /* All styles moved to getStyle API - prevents CSS leaking to page */
  /* See csui-child-components-styles.util.ts - getTasksPanelStyles() */
</style>

