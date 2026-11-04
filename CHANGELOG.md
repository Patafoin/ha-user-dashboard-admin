# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [1.0.0] - 2026-11-04

First stable release: same code as 1.0.0b1, validated in daily use (two tablets in kiosk mode with the Android Companion app, enforced rules, admin console). See the 1.0.0b1 notes below for the feature list.

## [1.0.0b1] - 2026-11-01

First public pre-release.

### Added

- Admin console (sidebar panel, administrators only): one card per user with sidebar entries (visible / hidden, order), default dashboard, kiosk mode, and how the rule applies (initial, enforced, not managed).
- Sidebar and default dashboard written into the per-user preferences the official frontend reads; enforced rules are re-applied when the user changes them.
- Kiosk mode per user, using the frontend's native kiosk mode, and one kiosk switch per user.
- Safeguards: an administrator always keeps Settings and the console, and cannot be put in kiosk mode.
- Security box: administrator status, admin-only dashboards, hidden dashboards still reachable by URL.
- Users created, removed or promoted to administrator are taken into account without a restart.
- Diagnostics; interface in English, French, German and Spanish.
