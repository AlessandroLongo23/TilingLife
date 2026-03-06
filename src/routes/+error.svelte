<script lang="ts">
	import { page } from '$app/stores';
	import { Home, BookOpen } from 'lucide-svelte';

	let status = $derived($page.status ?? 500);
	let technicalMessage = $derived($page.error?.message ?? 'Something went wrong');

	// User-friendly messages based on error type
	let { title, message, hint } = $derived.by(() => {
		switch (status) {
			case 404:
				return {
					title: 'Page not found',
					message: "The page you're looking for doesn't exist or has been moved.",
					hint: 'Check the URL or use the links below to navigate.'
				};
			case 403:
				return {
					title: 'Access denied',
					message: "You don't have permission to access this page.",
					hint: 'If you believe this is an error, please contact support.'
				};
			case 401:
				return {
					title: 'Sign in required',
					message: 'Please sign in to access this page.',
					hint: 'You may need to log in or create an account.'
				};
			case 500:
				return {
					title: 'Server error',
					message: 'Something went wrong on our end. Please try again later.',
					hint: 'If the problem persists, try refreshing the page.'
				};
			case 502:
			case 503:
				return {
					title: 'Service unavailable',
					message: 'The service is temporarily unavailable. Please try again in a few moments.',
					hint: 'We may be performing maintenance or experiencing high traffic.'
				};
			case 400:
				return {
					title: 'Bad request',
					message: 'Something was wrong with your request.',
					hint: 'Try going back and submitting again, or use the links below.'
				};
			default:
				return {
					title: 'Oops!',
					message: status >= 500 ? 'Something went wrong. Please try again later.' : technicalMessage,
					hint: 'Use the links below to get back on track.'
				};
		}
	});
</script>

<div class="error-page">
	<div class="error-card">
		<div class="error-icon">
			<span class="status-code">{status}</span>
		</div>
		<h1 class="error-title">{title}</h1>
		<p class="error-message">{message}</p>
		<p class="error-hint">{hint}</p>

		<div class="error-actions">
			<a href="/play" class="btn btn-primary">
				<Home size={18} />
				<span>Go to Play</span>
			</a>
			<a href="/algorithm/theory" class="btn btn-secondary">
				<BookOpen size={18} />
				<span>Go to Theory</span>
			</a>
		</div>
	</div>
</div>

<style>
	.error-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 2rem;
		background: linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%);
	}

	.error-card {
		max-width: 28rem;
		width: 100%;
		text-align: center;
		padding: 2.5rem 2rem;
		border-radius: 1rem;
		border: 1px solid rgba(63, 63, 70, 0.5);
		background: rgba(39, 39, 42, 0.6);
		backdrop-filter: blur(12px);
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
	}

	.error-icon {
		margin-bottom: 1.5rem;
	}

	.status-code {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 4rem;
		height: 4rem;
		font-size: 1.5rem;
		font-weight: 700;
		color: rgba(74, 222, 128, 0.9);
		background: rgba(74, 222, 128, 0.1);
		border-radius: 0.75rem;
		border: 1px solid rgba(74, 222, 128, 0.2);
	}

	.error-title {
		font-size: 1.75rem;
		font-weight: 600;
		color: rgb(250, 250, 250);
		margin: 0 0 0.5rem 0;
		letter-spacing: -0.025em;
	}

	.error-message {
		font-size: 0.95rem;
		color: rgba(161, 161, 170, 1);
		margin: 0 0 0.5rem 0;
		line-height: 1.5;
	}

	.error-details {
		margin: 0 0 1rem 0;
		text-align: left;
	}

	.error-details summary {
		font-size: 0.8rem;
		color: rgba(113, 113, 122, 1);
		cursor: pointer;
	}

	.error-details pre {
		margin: 0.5rem 0 0 0;
		padding: 0.75rem;
		font-size: 0.75rem;
		color: rgba(161, 161, 170, 1);
		background: rgba(0, 0, 0, 0.2);
		border-radius: 0.375rem;
		overflow-x: auto;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.error-hint {
		font-size: 0.8rem;
		color: rgba(113, 113, 122, 1);
		margin: 0 0 2rem 0;
	}

	.error-actions {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		width: 100%;
		padding: 0.75rem 1.25rem;
		font-size: 0.9rem;
		font-weight: 500;
		border-radius: 0.5rem;
		border: 1px solid transparent;
		cursor: pointer;
		transition: all 0.2s ease;
		text-decoration: none;
	}

	.btn-primary {
		background: rgba(22, 163, 74, 0.9);
		color: white;
		border-color: rgba(22, 163, 74, 0.5);
	}

	.btn-primary:hover {
		background: rgba(22, 163, 74, 1);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(22, 163, 74, 0.3);
	}

	.btn-secondary {
		background: rgba(63, 63, 70, 0.5);
		color: rgba(228, 228, 231, 1);
		border-color: rgba(63, 63, 70, 0.8);
	}

	.btn-secondary:hover {
		background: rgba(63, 63, 70, 0.7);
		border-color: rgba(74, 222, 128, 0.3);
		color: rgba(74, 222, 128, 0.95);
	}

	@media (min-width: 480px) {
		.error-actions {
			flex-direction: row;
			justify-content: center;
		}

		.btn {
			width: auto;
			min-width: 10rem;
		}
	}
</style>
