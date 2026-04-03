# Problem statement
Implement the new Request Review & Engagement Lifecycle by upgrading the current request detail hub, verifier/reviewer actions, edit upsert behavior, and engagement slot management while reusing existing templates and Dataverse Web API patterns.
## Current state overview
The request detail flow is centered in `RTP Form detail with code and image/Request-Details-Custom-Template.webtemplate.source.html` and request-type renderers (for RTP in `RTP Form detail with code and image/RenderRTPForm.webtemplate.source.html`). Verifier submission exists in `RTP Form detail with code and image/Custom-VerifyForm-Web-Template.webtemplate.source.html`. Engagement booking and slot admin flows are in `RTP Form detail with code and image/Custom-Engagement-Web-Template.webtemplate.source.html` and `RTP Form detail with code and image/Custom-Slots-Web-Template.webtemplate.source.html`. Suggestion create/list/update/delete exists but is modal-centric and not yet aligned with a dedicated Admin/Verifier notifications panel and status workflow.
## Proposed changes
### 1) Upgrade request detail hub layout and conditional sections
Modify `RTP Form detail with code and image/RenderRTPForm.webtemplate.source.html` first.
* Update `render_RTP_Request(...)` to render explicit sections in this order:
    * Document Header (top): clickable uploaded document links area placeholder mount point.
    * Basic Information: core identity fields.
    * Detailed Information: technical/project details.
    * General Review (conditional): visible only after verifier decision exists.
    * Reviewer Notifications (conditional): visible only when suggestion records exist and user role is Admin/Verifier.
* Replace current footer button status-only logic with role+status-aware action rendering hooks (still using existing button IDs where possible: `verifyBtn`, `reviewBtn`, `BookEngagmentBtn`).
* Re-enable decision/comment display by replacing the currently-empty `renderVerifierSection(...)` behavior.
### 2) Integrate role-gated actions and notifications in detail template shell
Modify `RTP Form detail with code and image/Request-Details-Custom-Template.webtemplate.source.html` second.
* Add role detection for Admin in script scope (`isAdmin`) and unify role gates for Requestor/Verifier/Reviewer/Admin.
* Add document-link hydration logic near existing subgrid context so Document Header can show top-level clickable files.
* Add a dedicated Reviewer Notifications block wiring:
    * load suggestions for request,
    * display only to Admin/Verifier,
    * allow status updates via dropdown (`Accepted`, `No Need`, with `Pending` default),
    * persist status changes through existing suggestion update API helper.
* Keep existing suggestion modal for reviewer contribution, but enforce Reviewer-only creation path and preserve multi-reviewer multi-suggestion behavior.
* Update click handlers in `handleNavigation(...)` and `pageForm` listener to preserve new role/status gates and modal launches.
### 3) Implement verifier modal workflow from detail page
Modify `RTP Form detail with code and image/Request-Details-Custom-Template.webtemplate.source.html` and `RTP Form detail with code and image/Custom-VerifyForm-Web-Template.webtemplate.source.html` third.
* Add a Bootstrap verifier modal to detail page with:
    * `Verifier Comment` textarea,
    * single-select `Decision Code` radio group.
* Wire `verifyBtn` to open modal rather than hard navigation.
* On submit, patch primary request with verifier fields already confirmed in the codebase (`gcp_verifier_comment`, `gcp_decisioncode`, `gcp_verifydate`) and, if a verifier identity field is discovered during implementation, persist it there too, then refresh detail UI sections.
* Keep `/verify/` page as fallback route; align field names and allowed decision/status transitions with modal submission logic.
### 4) Ensure edit flow performs strict upsert (update-only in edit mode)
Modify request detail edit URL generator and each request form submit handler entry point starting with RTP flow files fourth.
* In `RTP Form detail with code and image/Request-Details-Custom-Template.webtemplate.source.html`, keep `getEditFormURL(...)` but ensure all generated routes carry stable ID and `editform=true`.
* In each affected form template submit handler, enforce:
    * if `id` + `editform=true` present -> `PATCH` existing request/form row(s),
    * else -> `POST` create new.
* Begin with RTP template/form handlers, then apply same guard pattern to other form templates referenced by detail page routing.
### 5) Extend engagement slot assignment for one-or-more reviewers
Modify `RTP Form detail with code and image/Custom-Slots-Web-Template.webtemplate.source.html` fifth.
* Replace single attendee select with multi-select reviewer assignment control.
* On slot create, write slot and assigned reviewers relation (via link table or repeated association records according to current Dataverse schema).
* Update view-tab rendering to list assigned reviewers per slot.
### 6) Update requestor booking page to consume assigned reviewers
Modify `RTP Form detail with code and image/Custom-Engagement-Web-Template.webtemplate.source.html` sixth.
* Update slot fetch query to include assigned reviewer info.
* Show reviewer names in slot cards.
* Preserve existing booking/cancel status transitions while ensuring slot availability checks account for assigned reviewer data model.
### 7) Stabilize shared status/decision constants and helpers
Modify shared utilities include used by templates seventh.
* Add central enums/constants for decision code and reviewer suggestion statuses.
* Add helper mappers for labels and validation to avoid hard-coded scattered values.
### 8) Verification and regression checks
Run targeted validation after each phase.
* Detail page: section visibility by role and request status.
* Verifier modal: request patch and immediate UI reflection.
* Suggestions: reviewer creation + admin/verifier status update dropdown.
* Edit flow: no duplicate records in edit mode.
* Engagement: admin multi-reviewer slot creation and requestor booking success.
* Existing flows: back navigation, print, signature section, and existing status transitions remain functional.
