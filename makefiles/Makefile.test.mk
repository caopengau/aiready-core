###############################################################################
# Makefile.test: Testing-related targets
###############################################################################
include makefiles/Makefile.shared.mk

.PHONY: test test-core test-pattern-detect test-watch test-coverage test-verify-cli

test: ## Run tests for all packages (noninteractive)
	@$(call log_step,Running tests for all packages (noninteractive)...) 
	@if command -v turbo >/dev/null 2>&1; then \
		CI=1 turbo run test; \
	else \
		CI=1 $(PNPM) --no-interactive $(SILENT_PNPM) test; \
	fi
	@$(call log_success,All tests passed)

test-core: ## Run tests for core package only
	@$(call log_info,Running tests for @aiready/core...)
	@$(PNPM) --filter @aiready/core test
	@$(call log_success,Core tests passed)

test-pattern-detect: ## Run tests for pattern-detect package only
	@$(call log_info,Running tests for @aiready/pattern-detect...)
	@$(PNPM) --filter @aiready/pattern-detect test
	@$(call log_success,Pattern-detect tests passed)

test-watch: ## Run tests in watch mode
	@$(call log_info,Running tests in watch mode...)
	@$(PNPM) test --watch

test-coverage: ## Run tests with coverage report
	@$(call log_step,Running tests with coverage...)
	@$(PNPM) test --coverage
	@$(call log_success,Coverage report generated)

test-verify-cli: ## Run a smoke scan and verify CLI output
	@$(call log_step,Running CLI smoke test...)
	@# Ensure CLI is built first
	@$(PNPM) --filter @aiready/cli build
	@# Run scan on a small subdirectory
	@node ./packages/cli/dist/cli.js scan packages/cli/src || { $(call log_error,CLI scan failed); exit 1; }
	@$(call log_step,Verifying scan output...)
	@LATEST_REPORT=$$(ls -t packages/cli/src/.aiready/aiready-report-*.json | head -n1); \
	node ./scripts/verify-aiready-output.js "$$LATEST_REPORT" || { $(call log_error,Output verification failed); exit 1; }
	@$(call log_success,CLI smoke test passed)
