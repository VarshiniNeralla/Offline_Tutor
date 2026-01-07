# FINAL PLAN: AI-Assisted Oral Test Auto-Review (v1.0)

This plan integrates the official PRD requirements with the technical implementation details for CPU-only, 8GB RAM systems.

## 1. Specification (PRD Integration)

**Target Environment**: CPU-only, 8 GB RAM systems
**AI Components**:
- **STT**: `openai-whisper` (tiny/base)
- **LLM**: `qwen2.5:1.5b-instruct` (Ollama)
- **Constraint**: `num_ctx = 2048`, `num_predict ≤ 512`

### Status Management
- `IN_PROGRESS`: Student recording.
- `PENDING_REVIEW`: Submitted, waiting for STT/AI worker.
- `AI_REVIEWED`: STT/AI logic completed successfully.
- `AI_REVIEW_FAILED`: STT failure or empty transcript.
- `REVIEWED`: Teacher final approval given.

## 2. Technical Implementation Details

### Step 1: Model & Memory Optimization
- **Action**: Update `tutor_backend_multilingual.py` to prioritize `qwen2.5:1.5b`.
- **Action**: Hard-cap `num_ctx` and `num_predict` in `call_llama_optimized`.
- **Reasoning**: Larger context windows significantly increase RAM usage (KV cache). Reducing to 2048 is safe for 8GB RAM.

### Step 2: Robust Background Worker
- **Action**: Enhance `api.py` background worker to handle the PRD's specific exit states.
- **Logic**:
  1. If `transcribe_file` returns error or empty -> Status: `AI_REVIEW_FAILED`.
  2. If AI JSON fails once -> retry once.
  3. If all success -> Status: `AI_REVIEWED`.
  4. Always store `transcript` and `ai_analysis` blob in `student_progress.json`.

### Step 3: Frontend Alignment
- **Action**: Update `MyProgress.jsx` labels and disclaimer text.
- **Action**: Update `AdminDashboard.jsx` colors and "Approve" logic.

## 3. Final Task Checklist

- [ ] Update LLM fallback models and context parameters.
- [ ] Implement strict status transition logic in background worker.
- [ ] Refine Admin Dashboard UI for high/medium/low confidence colors.
- [ ] Add the specific STT disclaimer to the student view.
- [ ] Test the "One-click Approve" button.

---

## Final Plan Overview (The PRD Content)

### AI-Assisted Oral Test Auto-Review (PRD Highlights)
- **Purpose**: Reduce teacher workload with advisory AI suggestions while preserving teacher authority.
- **Goals**: Operates on 8GB RAM, integrated with My Progress, local-first.
- **Functional**: Local STT, AI Scoring (1-5), Keyword detection, Teacher approval workflow.
- **Failure handling**: Graceful degradation to manual review if STT/AI fails.
