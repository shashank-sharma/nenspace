<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Label } from '$lib/components/ui/label';
	import { Textarea } from '$lib/components/ui/textarea';
	import * as Select from '$lib/components/ui/select';
	import { Switch } from '$lib/components/ui/switch';
	import { cronService } from '../services';
	import type { CreateCronData, Cron } from '../types';
	import { toast } from 'svelte-sonner';

	let { cron, onSuccess, onCancel } = $props<{
		cron?: Cron;
		onSuccess: () => void;
		onCancel: () => void;
	}>();

	let isSubmitting = $state(false);
	let name = $state(cron?.name || '');
	let description = $state(cron?.description || '');
	let schedule = $state(cron?.schedule || '*/5 * * * *');
	let webhookUrl = $state(cron?.webhook_url || '');
	let webhookMethod = $state(cron?.webhook_method || 'POST');
	let webhookHeaders = $state(JSON.stringify(cron?.webhook_headers || {}, null, 2));
	let webhookPayload = $state(JSON.stringify(cron?.webhook_payload || {}, null, 2));
	let timeoutSeconds = $state(cron?.timeout_seconds || 30);
	let notifyOnSuccess = $state(cron?.notify_on_success || false);
	let notifyOnFailure = $state(cron?.notify_on_failure || true);
	let notificationWebhook = $state(cron?.notification_webhook || '');
	let maxRetries = $state(cron?.max_retries || 0);
	let retryDelaySeconds = $state(cron?.retry_delay_seconds || 60);

	// Sync props to state when cron prop changes
	$effect(() => {
		if (cron) {
			name = cron.name || '';
			description = cron.description || '';
			schedule = cron.schedule || '*/5 * * * *';
			webhookUrl = cron.webhook_url || '';
			webhookMethod = cron.webhook_method || 'POST';
			webhookHeaders = JSON.stringify(cron.webhook_headers || {}, null, 2);
			webhookPayload = JSON.stringify(cron.webhook_payload || {}, null, 2);
			timeoutSeconds = cron.timeout_seconds || 30;
			notifyOnSuccess = cron.notify_on_success || false;
			notifyOnFailure = cron.notify_on_failure ?? true;
			notificationWebhook = cron.notification_webhook || '';
			maxRetries = cron.max_retries || 0;
			retryDelaySeconds = cron.retry_delay_seconds || 60;
		}
	});

	let headerError = $state('');
	let payloadError = $state('');

	const headersPlaceholder = '{"Authorization": "Bearer token", "Content-Type": "application/json"}';
	const payloadPlaceholder = '{"key": "value"}';

	function validateJSON(jsonStr: string): boolean {
		try {
			if (!jsonStr.trim()) return true;
			JSON.parse(jsonStr);
			return true;
		} catch {
			return false;
		}
	}

	$effect(() => {
		if (webhookHeaders && !validateJSON(webhookHeaders)) {
			headerError = 'Invalid JSON';
		} else {
			headerError = '';
		}
	});

	$effect(() => {
		if (webhookPayload && !validateJSON(webhookPayload)) {
			payloadError = 'Invalid JSON';
		} else {
			payloadError = '';
		}
	});

	async function handleSubmit() {
		if (!name.trim()) {
			toast.error('Name is required');
			return;
		}
		if (!schedule.trim()) {
			toast.error('Schedule is required');
			return;
		}
		if (!webhookUrl.trim()) {
			toast.error('Webhook URL is required');
			return;
		}
		if (headerError || payloadError) {
			toast.error('Please fix JSON errors');
			return;
		}

		isSubmitting = true;
		try {
			// Ensure webhookMethod has a value, default to POST if empty
			const method = webhookMethod || 'POST';
			
			const data: CreateCronData = {
				name: name.trim(),
				description: description.trim() || undefined,
				schedule: schedule.trim(),
				webhook_url: webhookUrl.trim(),
				webhook_method: method,
				timeout_seconds: timeoutSeconds,
				notify_on_success: notifyOnSuccess,
				notify_on_failure: notifyOnFailure,
				notification_webhook: notificationWebhook.trim() || undefined,
				max_retries: maxRetries,
				retry_delay_seconds: retryDelaySeconds
			};

			if (webhookHeaders.trim()) {
				data.webhook_headers = JSON.parse(webhookHeaders);
			}

			if (webhookPayload.trim()) {
				data.webhook_payload = JSON.parse(webhookPayload);
			}

			let result;
			if (cron) {
				result = await cronService.updateCron(cron.id, data);
			} else {
				result = await cronService.createCron(data);
			}

			// Check if result is null (error occurred)
			if (!result) {
				// Error toast already shown by withErrorHandling
				return;
			}

			toast.success(cron ? 'Cron updated successfully' : 'Cron created successfully');
			onSuccess();
		} catch (error: any) {
			toast.error(error?.message || 'Failed to save cron');
			console.error(error);
		} finally {
			isSubmitting = false;
		}
	}
</script>

<div class="space-y-6">
	<div class="space-y-2">
		<Label for="name">Name *</Label>
		<Input id="name" bind:value={name} placeholder="My Cron Job" required />
	</div>

	<div class="space-y-2">
		<Label for="description">Description</Label>
		<Textarea id="description" bind:value={description} placeholder="What does this cron do?" />
	</div>

	<div class="space-y-2">
		<Label for="schedule">Schedule (Cron Expression) *</Label>
		<Input id="schedule" bind:value={schedule} placeholder="*/5 * * * *" required />
		<p class="text-xs text-muted-foreground">
			Format: minute hour day month weekday (e.g., "*/5 * * * *" = every 5 minutes)
		</p>
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-2">
			<Label for="webhook_url">Webhook URL *</Label>
			<Input id="webhook_url" bind:value={webhookUrl} type="url" placeholder="https://example.com/webhook" required />
		</div>
		<div class="space-y-2">
			<Label for="webhook_method">HTTP Method</Label>
			<Select.Root
				selected={webhookMethod ? { value: webhookMethod, label: webhookMethod } : undefined}
				onSelectedChange={(value) => {
					if (value) {
						webhookMethod = value.value;
					}
				}}
			>
				<Select.Trigger id="webhook_method">
					<Select.Value placeholder="Select method" />
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="GET">GET</Select.Item>
					<Select.Item value="POST">POST</Select.Item>
					<Select.Item value="PUT">PUT</Select.Item>
					<Select.Item value="DELETE">DELETE</Select.Item>
					<Select.Item value="PATCH">PATCH</Select.Item>
				</Select.Content>
			</Select.Root>
		</div>
	</div>

	<div class="space-y-2">
		<Label for="webhook_headers">Headers (JSON)</Label>
		<Textarea
			id="webhook_headers"
			bind:value={webhookHeaders}
			placeholder={headersPlaceholder}
			class="font-mono text-xs"
		/>
		{#if headerError}
			<p class="text-xs text-destructive">{headerError}</p>
		{/if}
	</div>

	<div class="space-y-2">
		<Label for="webhook_payload">Payload (JSON)</Label>
		<Textarea
			id="webhook_payload"
			bind:value={webhookPayload}
			placeholder={payloadPlaceholder}
			class="font-mono text-xs"
		/>
		{#if payloadError}
			<p class="text-xs text-destructive">{payloadError}</p>
		{/if}
	</div>

	<div class="space-y-2">
		<Label for="timeout_seconds">Timeout (seconds)</Label>
		<Input id="timeout_seconds" bind:value={timeoutSeconds} type="number" min="1" max="300" />
	</div>

	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div>
				<Label for="notify_on_success">Notify on Success</Label>
				<p class="text-xs text-muted-foreground">Send notification when execution succeeds</p>
			</div>
			<Switch id="notify_on_success" bind:checked={notifyOnSuccess} />
		</div>

		<div class="flex items-center justify-between">
			<div>
				<Label for="notify_on_failure">Notify on Failure</Label>
				<p class="text-xs text-muted-foreground">Send notification when execution fails</p>
			</div>
			<Switch id="notify_on_failure" bind:checked={notifyOnFailure} />
		</div>
	</div>

	<div class="space-y-2">
		<Label for="notification_webhook">Notification Webhook</Label>
		<Input id="notification_webhook" bind:value={notificationWebhook} type="url" placeholder="https://example.com/notify" />
	</div>

	<div class="grid grid-cols-2 gap-4">
		<div class="space-y-2">
			<Label for="max_retries">Max Retries</Label>
			<Input id="max_retries" bind:value={maxRetries} type="number" min="0" max="10" />
		</div>
		<div class="space-y-2">
			<Label for="retry_delay_seconds">Retry Delay (seconds)</Label>
			<Input id="retry_delay_seconds" bind:value={retryDelaySeconds} type="number" min="1" max="3600" />
		</div>
	</div>

	<div class="flex justify-end gap-2 pt-4">
		<Button variant="outline" onclick={onCancel} disabled={isSubmitting}>
			Cancel
		</Button>
		<Button onclick={handleSubmit} disabled={isSubmitting}>
			{isSubmitting ? 'Saving...' : cron ? 'Update' : 'Create'}
		</Button>
	</div>
</div>
