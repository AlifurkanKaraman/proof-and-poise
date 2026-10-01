# 01. Problem and users

## Problem

Job seekers are told to "tailor the resume" and "practice interviews," but the tools for both have two gaps:

- Resume optimizers rewrite text to match a job description. They often add skills, numbers, or claims the candidate never wrote. That helps keyword scores and hurts the candidate in the interview.
- Mock interview tools ask generic questions. They don't know which parts of this candidate's experience are weakly supported for this job, so practice time goes to the wrong topics.

The two activities are disconnected, and neither explains its scores.

## What Proof & Poise does

A candidate provides a resume (PDF or pasted text) and a job description. The app:

1. Builds a competency map from the job and links each competency to verbatim quotes from the resume (Req 5).
2. Shows explainable scores: Job Match, Evidence Coverage, Keyword Coverage, and Resume Parseability, each with its formula (Req 6, design §6).
3. Suggests resume changes with a trust label (verified from resume, confirmed by candidate, missing evidence, rewording only). The candidate accepts or rejects each one (Req 7).
4. Lets the candidate confirm missing experience in their own words, with an attestation (Req 8).
5. Runs a five-question mock interview aimed at the weakest evidence, with at least one follow-up (Req 9, 11).
6. Produces a readiness report with the reasoning behind every number and a "practice again" loop (Req 12).

## Users

- International students, who often have real experience but less practice presenting it in a US interview format.
- Early-career candidates with internships, projects, and coursework instead of long work histories.
- Other job seekers who want honest feedback rather than inflated rewrites.

The MVP is anonymous: no accounts, a server-issued session token, and a 24-hour data lifetime (Req 2). A public demo with a fictional candidate lets anyone try the full journey without sharing a resume (Req 13).

## Non-goals for the MVP

Accounts and history, resume export, voice playback, streaming transcription, and a mobile app. See the post-hackathon list in `requirements.md` and [09-limitations.md](09-limitations.md).
