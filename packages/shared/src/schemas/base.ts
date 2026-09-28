/**
 * base.ts
 * Fundamental types and enums used across schemas.
 */

import { z } from 'zod';

// Importance levels for competencies (from job description)
export const ImportanceSchema = z.enum(['required', 'preferred', 'contextual']);
export type Importance = z.infer<typeof ImportanceSchema>;

// Strength of evidence for a competency
export const StrengthSchema = z.enum(['strong', 'moderate', 'weak', 'none']);
export type Strength = z.infer<typeof StrengthSchema>;

// Trust labels for recommendations
export const TrustLabelSchema = z.enum([
  'verified_from_resume',
  'confirmed_by_candidate',
  'missing_evidence',
  'rewording_only',
]);
export type TrustLabel = z.infer<typeof TrustLabelSchema>;

// Competency categories
export const CompetencyCategorySchema = z.enum(['technical', 'behavioral', 'domain']);
export type CompetencyCategory = z.infer<typeof CompetencyCategorySchema>;

// Resume sections
export const ResumeSectionSchema = z.enum(['experience', 'projects', 'education', 'skills', 'other']);
export type ResumeSection = z.infer<typeof ResumeSectionSchema>;

// Evidence sources
export const EvidenceSourceSchema = z.enum(['resume', 'candidate_confirmation']);
export type EvidenceSource = z.infer<typeof EvidenceSourceSchema>;

// Seniority levels
export const SenioritySchema = z.enum(['intern', 'entry', 'mid', 'senior']);
export type Seniority = z.infer<typeof SenioritySchema>;

// Confirmation states
export const ConfirmationStateSchema = z.enum(['none', 'confirmed']);
export type ConfirmationState = z.infer<typeof ConfirmationStateSchema>;

// Readiness levels
export const ReadinessSchema = z.enum(['ready', 'developing', 'needs_practice', 'not_assessed']);
export type Readiness = z.infer<typeof ReadinessSchema>;

// Decision states for recommendations
export const DecisionSchema = z.enum(['pending', 'accepted', 'rejected']);
export type Decision = z.infer<typeof DecisionSchema>;

// Answer sources
export const AnswerSourceSchema = z.enum(['typed', 'transcribed']);
export type AnswerSource = z.infer<typeof AnswerSourceSchema>;

// Turn kinds for interview questions
export const TurnKindSchema = z.enum([
  'behavioral',
  'role_specific',
  'evidence_gap',
  'follow_up',
  'practice',
]);
export type TurnKind = z.infer<typeof TurnKindSchema>;

// Turn status
export const TurnStatusSchema = z.enum(['asked', 'transcribing', 'answered', 'evaluated', 'failed']);
export type TurnStatus = z.infer<typeof TurnStatusSchema>;

// Evaluation dimensions (for behavioral questions)
export const DimensionSchema = z.enum([
  'relevance',
  'specificity',
  'evidence',
  'star',
  'clarity',
  'ownership',
  'role_connection',
]);
export type Dimension = z.infer<typeof DimensionSchema>;

// Session modes
export const SessionModeSchema = z.enum(['standard', 'demo']);
export type SessionMode = z.infer<typeof SessionModeSchema>;

// Session stages
export const SessionStageSchema = z.enum([
  'created',
  'input_provided',
  'analysis_queued',
  'analysis_ready',
  'interview_planned',
  'interview_in_progress',
  'interview_complete',
  'report_ready',
]);
export type SessionStage = z.infer<typeof SessionStageSchema>;

// Analysis status
export const AnalysisStatusSchema = z.enum(['pending', 'queued', 'processing', 'ready', 'failed']);
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;
