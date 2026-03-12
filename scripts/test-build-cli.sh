#!/bin/sh

set -eu

APP_DIR="/app"
SANDBOX_DIR="$(mktemp -d)"
PASS_COUNT=0

cleanup() {
	rm -rf "$SANDBOX_DIR"
}

trap cleanup EXIT

pass() {
	PASS_COUNT=$((PASS_COUNT + 1))
	printf 'ok - %s\n' "$1"
}

fail() {
	printf 'not ok - %s\n' "$1" >&2
	exit 1
}

assert_contains() {
	file_path="$1"
	expected="$2"
	label="$3"

	if ! grep -Fq "$expected" "$file_path"; then
		printf 'expected to find %s in %s\n' "$expected" "$file_path" >&2
		cat "$file_path" >&2
		fail "$label"
	fi
}

assert_not_contains() {
	file_path="$1"
	unexpected="$2"
	label="$3"

	if grep -Fq "$unexpected" "$file_path"; then
		printf 'did not expect to find %s in %s\n' "$unexpected" "$file_path" >&2
		cat "$file_path" >&2
		fail "$label"
	fi
}

assert_equals() {
	expected="$1"
	actual="$2"
	label="$3"

	if [ "$expected" != "$actual" ]; then
		printf 'expected %s but received %s\n' "$expected" "$actual" >&2
		fail "$label"
	fi
}

run_cli_capture() {
	dir_path="$1"
	home_path="$2"
	prefix="$3"
	shift 3

	set +e
	(
		cd "$dir_path"
		HOME="$home_path" node "$APP_DIR/dist/index.mjs" "$@"
	) >"$prefix.stdout" 2>"$prefix.stderr"
	status="$?"
	set -e

	printf '%s' "$status" >"$prefix.status"
}

run_expect() {
	prefix="$1"
	script_name="$2"
	repo_path="$3"
	home_path="$4"
	message_value="${5-}"

	set +e
	EXPECT_SCRIPT_NAME="$script_name" EXPECT_REPO_PATH="$repo_path" EXPECT_HOME_PATH="$home_path" EXPECT_APP_DIR="$APP_DIR" EXPECT_COMMIT_MESSAGE="$message_value" expect <<'EOF' >"$prefix.stdout" 2>"$prefix.stderr"
set timeout 20
match_max 100000

set scriptName $env(EXPECT_SCRIPT_NAME)
set repoPath $env(EXPECT_REPO_PATH)
set homePath $env(EXPECT_HOME_PATH)
set appDir $env(EXPECT_APP_DIR)
set commitMessage $env(EXPECT_COMMIT_MESSAGE)

spawn sh -lc "cd \"$repoPath\" && HOME=\"$homePath\" node \"$appDir/dist/index.mjs\""

if {$scriptName eq "stage-all-commit"} {
  expect "changes"
  send "\r"
  expect "Commit message"
  send "$commitMessage\r"
  expect "Run post command: git push?"
  send "n\r"
  expect eof
  exit 0
}

if {$scriptName eq "subset-commit"} {
  expect "changes"
  send " "
  send "\r"
  expect "Commit message"
  send "$commitMessage\r"
  expect "Run post command: git push?"
  send "n\r"
  expect eof
  exit 0
}

if {$scriptName eq "delete-commit"} {
  expect "changes"
  send "\r"
  expect "Commit message"
  send "$commitMessage\r"
  expect "Run post command: git push?"
  send "n\r"
  expect eof
  exit 0
}

if {$scriptName eq "empty-message-no-models"} {
  expect "changes"
  send "\r"
  expect "Commit message"
  send "\r"
  expect "No models are configured for commit message generation."
  expect eof
  exit 0
}

if {$scriptName eq "unsupported-provider"} {
  expect "changes"
  send "\r"
  expect "Unsupported model provider"
  expect eof
  exit 0
}

if {$scriptName eq "decline-push"} {
  expect "changes"
  send "\r"
  expect "Commit message"
  send "$commitMessage\r"
  expect "Run post command: git push?"
  send "n\r"
  expect eof
  exit 0
}

if {$scriptName eq "auto-push"} {
  expect "changes"
  send "\r"
  expect "Commit message"
  send "$commitMessage\r"
  expect eof
  exit 0
}

if {$scriptName eq "push-and-pull-decline"} {
  expect "changes"
  send "\r"
  expect "Commit message"
  send "$commitMessage\r"
  expect "Run post command: git push && git pull --rebase?"
  send "n\r"
  expect eof
  exit 0
}

puts stderr "Unknown expect script: $scriptName"
exit 1
EOF
	status="$?"
	set -e

	printf '%s' "$status" >"$prefix.status"
}

new_home() {
	name="$1"
	home_path="$SANDBOX_DIR/homes/$name"
	mkdir -p "$home_path/.config"
	printf '%s' "$home_path"
}

write_global_config() {
	home_path="$1"
	config_json="$2"
	printf '%s\n' "$config_json" >"$home_path/.config/gityo.json"
}

new_repo() {
	name="$1"
	repo_path="$SANDBOX_DIR/repos/$name"
	mkdir -p "$repo_path"
	git init "$repo_path" >/dev/null 2>&1
	git -C "$repo_path" config user.name "gityo test"
	git -C "$repo_path" config user.email "gityo@example.com"
	printf '%s' "$repo_path"
}

new_remote() {
	name="$1"
	remote_path="$SANDBOX_DIR/remotes/$name.git"
	git init --bare "$remote_path" >/dev/null 2>&1
	printf '%s' "$remote_path"
}

seed_file_commit() {
	repo_path="$1"
	file_name="$2"
	file_contents="$3"
	message="$4"

	printf '%s\n' "$file_contents" >"$repo_path/$file_name"
	git -C "$repo_path" add "$file_name"
	git -C "$repo_path" commit -m "$message" >/dev/null 2>&1
}

current_branch() {
	repo_path="$1"
	git -C "$repo_path" branch --show-current
}

test_help_output() {
	home_path="$(new_home help)"
	prefix="$SANDBOX_DIR/results/help"
	mkdir -p "$SANDBOX_DIR/results"
	run_cli_capture "$APP_DIR" "$home_path" "$prefix" --help
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'help exits successfully'
	assert_contains "$prefix.stdout" 'gityo' 'help includes command name'
	assert_contains "$prefix.stdout" 'Usage:' 'help shows usage'
	pass 'help output'
}

test_outside_git_repo_failure() {
	home_path="$(new_home outside)"
	dir_path="$SANDBOX_DIR/outside"
	prefix="$SANDBOX_DIR/results/outside"
	mkdir -p "$dir_path"
	run_cli_capture "$dir_path" "$home_path" "$prefix"
	status="$(cat "$prefix.status")"
	if [ "$status" -eq 0 ]; then
		fail 'outside git repo should fail'
	fi
	assert_contains "$prefix.stderr" 'gityo must be run inside a git repository.' 'outside git repo error message'
	pass 'outside git repo failure'
}

test_clean_repo_message() {
	home_path="$(new_home clean)"
	repo_path="$(new_repo clean)"
	prefix="$SANDBOX_DIR/results/clean"
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	run_cli_capture "$repo_path" "$home_path" "$prefix"
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'clean repo exits successfully'
	assert_contains "$prefix.stdout" 'No changed files found.' 'clean repo message'
	pass 'clean repo message'
}

test_invalid_project_config_failure() {
	home_path="$(new_home invalid-project-config)"
	repo_path="$(new_repo invalid-project-config)"
	prefix="$SANDBOX_DIR/results/invalid-project-config"
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	printf '{invalid-json\n' >"$repo_path/.gityo.config.json"
	run_cli_capture "$repo_path" "$home_path" "$prefix"
	status="$(cat "$prefix.status")"
	if [ "$status" -eq 0 ]; then
		fail 'invalid config should fail'
	fi
	assert_contains "$prefix.stderr" 'Invalid config in' 'invalid config error message'
	pass 'invalid project config failure'
}

test_empty_message_without_models_failure() {
	home_path="$(new_home empty-message)"
	repo_path="$(new_repo empty-message)"
	prefix="$SANDBOX_DIR/results/empty-message"
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	printf 'changed\n' >"$repo_path/tracked.txt"
	run_expect "$prefix" 'empty-message-no-models' "$repo_path" "$home_path"
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'empty commit message test interaction'
	assert_contains "$prefix.stdout" 'No models are configured for commit message generation.' 'empty message error'
	assert_equals 'chore: seed repo' "$(git -C "$repo_path" log -1 --pretty=%s)" 'empty message should not create commit'
	pass 'empty message without models failure'
}

test_stage_all_commits_all_changes() {
	home_path="$(new_home stage-all)"
	repo_path="$(new_repo stage-all)"
	prefix="$SANDBOX_DIR/results/stage-all"
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	printf 'changed\n' >"$repo_path/tracked.txt"
	printf 'new file\n' >"$repo_path/untracked.txt"
	run_expect "$prefix" 'stage-all-commit' "$repo_path" "$home_path" 'feat: stage all changes'
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'stage all interaction'
	assert_equals 'feat: stage all changes' "$(git -C "$repo_path" log -1 --pretty=%s)" 'stage all commit message'
	git -C "$repo_path" show --name-only --pretty=format: HEAD >"$prefix.files"
	assert_contains "$prefix.files" 'tracked.txt' 'stage all commit includes tracked file'
	assert_contains "$prefix.files" 'untracked.txt' 'stage all commit includes untracked file'
	git -C "$repo_path" diff --quiet
	git -C "$repo_path" diff --cached --quiet
	pass 'stage all commits all changes'
}

test_subset_selection_commits_only_selected_file() {
	home_path="$(new_home subset)"
	repo_path="$(new_repo subset)"
	prefix="$SANDBOX_DIR/results/subset"
	seed_file_commit "$repo_path" 'alpha.txt' 'alpha seed' 'chore: seed alpha'
	printf 'beta seed\n' >"$repo_path/beta.txt"
	git -C "$repo_path" add beta.txt
	git -C "$repo_path" commit -m 'chore: add beta' >/dev/null 2>&1
	printf 'alpha changed\n' >"$repo_path/alpha.txt"
	printf 'beta changed\n' >"$repo_path/beta.txt"
	run_expect "$prefix" 'subset-commit' "$repo_path" "$home_path" 'feat: commit only alpha'
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'subset interaction'
	assert_equals 'feat: commit only alpha' "$(git -C "$repo_path" log -1 --pretty=%s)" 'subset commit message'
	git -C "$repo_path" show --name-only --pretty=format: HEAD >"$prefix.files"
	assert_contains "$prefix.files" 'alpha.txt' 'subset commit includes alpha'
	assert_not_contains "$prefix.files" 'beta.txt' 'subset commit excludes beta'
	assert_contains "$prefix.stdout" 'Run post command: git push?' 'subset reached post command prompt'
	assert_contains "$repo_path/beta.txt" 'beta changed' 'subset leaves beta modified'
	pass 'subset selection commits only selected file'
}

test_deleted_file_commit() {
	home_path="$(new_home delete-file)"
	repo_path="$(new_repo delete-file)"
	prefix="$SANDBOX_DIR/results/delete-file"
	seed_file_commit "$repo_path" 'remove.txt' 'remove me' 'chore: add removable file'
	rm "$repo_path/remove.txt"
	run_expect "$prefix" 'delete-commit' "$repo_path" "$home_path" 'feat: delete old file'
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'delete file interaction'
	if [ -e "$repo_path/remove.txt" ]; then
		fail 'deleted file should stay deleted after commit'
	fi
	git -C "$repo_path" show --summary --format= HEAD >"$prefix.summary"
	assert_contains "$prefix.summary" 'delete mode' 'delete commit summary'
	pass 'deleted file commit'
}

test_declining_push_keeps_remote_unchanged() {
	home_path="$(new_home decline-push)"
	repo_path="$(new_repo decline-push)"
	remote_path="$(new_remote decline-push)"
	prefix="$SANDBOX_DIR/results/decline-push"
	write_global_config "$home_path" '{"models":{},"postCommand":"push","autoRunPostCommand":false}'
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	git -C "$repo_path" remote add origin "$remote_path"
	branch_name="$(current_branch "$repo_path")"
	git -C "$repo_path" push -u origin "$branch_name" >/dev/null 2>&1
	remote_before="$(git --git-dir "$remote_path" rev-parse "refs/heads/$branch_name")"
	printf 'changed\n' >"$repo_path/tracked.txt"
	run_expect "$prefix" 'decline-push' "$repo_path" "$home_path" 'feat: local only commit'
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'decline push interaction'
	remote_after="$(git --git-dir "$remote_path" rev-parse "refs/heads/$branch_name")"
	assert_equals "$remote_before" "$remote_after" 'declining push keeps remote unchanged'
	pass 'declining push keeps remote unchanged'
}

test_auto_run_push_updates_remote() {
	home_path="$(new_home auto-push)"
	repo_path="$(new_repo auto-push)"
	remote_path="$(new_remote auto-push)"
	prefix="$SANDBOX_DIR/results/auto-push"
	write_global_config "$home_path" '{"models":{},"postCommand":"push","autoRunPostCommand":true}'
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	git -C "$repo_path" remote add origin "$remote_path"
	branch_name="$(current_branch "$repo_path")"
	git -C "$repo_path" push -u origin "$branch_name" >/dev/null 2>&1
	printf 'changed\n' >"$repo_path/tracked.txt"
	run_expect "$prefix" 'auto-push' "$repo_path" "$home_path" 'feat: push automatically'
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'auto push interaction'
	assert_equals "$(git -C "$repo_path" rev-parse HEAD)" "$(git --git-dir "$remote_path" rev-parse "refs/heads/$branch_name")" 'auto push updates remote'
	pass 'auto run push updates remote'
}

test_push_and_pull_prompt_label() {
	home_path="$(new_home push-and-pull)"
	repo_path="$(new_repo push-and-pull)"
	prefix="$SANDBOX_DIR/results/push-and-pull"
	write_global_config "$home_path" '{"models":{},"postCommand":"push-and-pull","autoRunPostCommand":false}'
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	printf 'changed\n' >"$repo_path/tracked.txt"
	run_expect "$prefix" 'push-and-pull-decline' "$repo_path" "$home_path" 'feat: inspect push and pull prompt'
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'push-and-pull interaction'
	assert_contains "$prefix.stdout" 'Run post command: git push && git pull --rebase?' 'push-and-pull prompt label'
	pass 'push-and-pull prompt label'
}

test_unsupported_provider_failure() {
	home_path="$(new_home unsupported-provider)"
	repo_path="$(new_repo unsupported-provider)"
	prefix="$SANDBOX_DIR/results/unsupported-provider"
	write_global_config "$home_path" '{"models":{"broken-provider":["model-a"]}}'
	seed_file_commit "$repo_path" 'tracked.txt' 'seed' 'chore: seed repo'
	printf 'changed\n' >"$repo_path/tracked.txt"
	run_expect "$prefix" 'unsupported-provider' "$repo_path" "$home_path"
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'unsupported provider interaction'
	assert_contains "$prefix.stdout" 'Unsupported model provider' 'unsupported provider error'
	assert_equals 'chore: seed repo' "$(git -C "$repo_path" log -1 --pretty=%s)" 'unsupported provider should not create commit'
	pass 'unsupported provider failure'
}

test_models_help_output() {
	home_path="$(new_home models-help)"
	prefix="$SANDBOX_DIR/results/models-help"
	run_cli_capture "$APP_DIR" "$home_path" "$prefix" models --help
	status="$(cat "$prefix.status")"
	assert_equals 0 "$status" 'models help exits successfully'
	assert_contains "$prefix.stdout" 'Manage configured models and stored API keys.' 'models help description'
	pass 'models help output'
}

mkdir -p "$SANDBOX_DIR/results" "$SANDBOX_DIR/homes" "$SANDBOX_DIR/repos" "$SANDBOX_DIR/remotes"

test_help_output
test_models_help_output
test_outside_git_repo_failure
test_clean_repo_message
test_invalid_project_config_failure
test_empty_message_without_models_failure
test_stage_all_commits_all_changes
test_subset_selection_commits_only_selected_file
test_deleted_file_commit
test_declining_push_keeps_remote_unchanged
test_auto_run_push_updates_remote
test_push_and_pull_prompt_label
test_unsupported_provider_failure

printf 'all %s docker integration tests passed\n' "$PASS_COUNT"
