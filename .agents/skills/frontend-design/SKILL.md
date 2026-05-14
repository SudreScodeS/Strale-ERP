---
name: frontend-design
description: Use this skill when creating, reviewing, redesigning, or improving frontend interfaces in the Elitium ERP project, including landing pages, dashboards, SaaS screens, product sections, components, app shells, forms, empty states, and AI-driven UI experiences. Focus on production-grade implementation, strong visual direction, high-quality UX, and avoiding generic AI-generated design.
---

# Frontend Design

This skill guides the creation and improvement of distinctive, production-grade frontend interfaces for the Elitium ERP project.

The goal is to avoid generic AI-looking UI and produce interfaces that feel intentional, professional, polished, and usable.

For this project, the visual direction should be suitable for an ERP/SaaS product: modern, premium, reliable, clear, and business-oriented.

Do not make the interface experimental just for the sake of being different.

## Core Objective

Create real working frontend code with strong visual quality, clean structure, and practical UX.

The result should feel like a real startup product, not a template or a generic AI-generated landing page.

The interface should be:

- production-grade;
- functional;
- visually refined;
- cohesive with the existing brand;
- clear for business users;
- responsive, especially on 1920x1080 screens;
- maintainable inside the existing codebase.

## Before Coding

Before making changes, understand the context:

- What screen, section, or component is being improved?
- What problem does this interface solve?
- Who is the user?
- What information is most important?
- What components already exist in the project?
- What visual language is already being used?
- What should remain consistent with the current identity?
- What should be improved because it looks generic, empty, confusing, or unfinished?

When working on an existing project, inspect the current structure before editing files.

Do not rewrite large parts of the project without a clear reason.

## Design Direction

Choose a clear aesthetic direction, but keep it compatible with an ERP/SaaS product.

Good directions for Elitium ERP include:

- refined SaaS;
- premium operational dashboard;
- clean enterprise system;
- futuristic but restrained;
- editorial product storytelling;
- data-driven command center;
- elegant dark interface;
- light professional business interface.

Avoid directions that make the product feel childish, chaotic, overly artistic, or hard to use.

Boldness is welcome, but usability and trust come first.

## What Makes the Design Memorable

Every important interface should have at least one memorable quality, such as:

- a strong hero composition;
- a realistic product dashboard;
- a polished AI assistant panel;
- a distinctive navigation structure;
- useful data visualization;
- elegant motion;
- premium spacing and hierarchy;
- a product section that feels like a real SaaS demo.

The memorable element should support the product message, not distract from it.

## Frontend Aesthetic Guidelines

### Typography

Use typography intentionally.

Prefer clear, professional, readable type systems.

Avoid using fonts randomly just to look different.

Do not replace the project typography unless there is a strong reason.

If the project already uses a specific font system, preserve it and improve hierarchy using:

- font size;
- weight;
- spacing;
- line height;
- contrast;
- layout;
- section rhythm.

Avoid default-looking typography where every title, label, and paragraph feels the same.

### Color and Theme

Respect the existing Elitium ERP identity.

Improve the palette when necessary, but do not completely change the brand without justification.

Use color with purpose:

- primary actions;
- status indicators;
- alerts;
- highlights;
- AI insights;
- product metrics.

Avoid generic purple gradients on white backgrounds unless they are already part of the brand.

Avoid using too many accent colors at once.

Do not introduce CSS variables unless the project already uses them or the user explicitly wants them. If the current codebase avoids CSS variables, follow the existing style.

### Layout and Spatial Composition

Prioritize strong layout decisions.

Improve:

- spacing;
- alignment;
- visual hierarchy;
- section rhythm;
- responsive behavior;
- density of information;
- balance between text and UI elements;
- empty areas that feel unfinished.

For ERP and dashboard screens, controlled density is usually better than excessive empty space.

For landing/product sections, use negative space intentionally, not because content is missing.

Avoid predictable card grids when a more meaningful composition would communicate the product better.

### Components

Components should look useful, not decorative.

Cards should contain meaningful information.

Buttons should have clear purpose.

Dashboards should show realistic data.

AI panels should feel connected to the ERP data, not like a generic chatbot.

Forms, tables, widgets, sidebars, and product previews should feel consistent.

### Motion

Use motion with restraint.

Motion should improve understanding, flow, or perceived quality.

Good uses:

- subtle reveal animations;
- hover feedback;
- smooth transitions;
- focused microinteractions;
- product demo progression;
- AI response reveal;
- scroll-based storytelling when already part of the design.

Avoid excessive motion that makes the ERP feel unstable or distracting.

Do not add heavy animation libraries unless they already exist in the project or there is a clear reason.

### Backgrounds and Visual Details

Use visual details to create depth and polish.

Good options:

- subtle gradients;
- soft shadows;
- glass-like surfaces when appropriate;
- light grid patterns;
- muted glow effects;
- layered panels;
- refined borders;
- realistic dashboard surfaces.

Avoid visual noise.

Do not add decorative effects that hurt readability or performance.

## Avoid Generic AI Design

Avoid:

- generic SaaS card grids;
- random glowing blobs;
- purple gradient clichés;
- fake metrics with no purpose;
- sections that look copied from a template;
- excessive rounded cards with no hierarchy;
- empty mockups;
- repeated icons without meaning;
- text that says a lot but explains little;
- UI that looks pretty but does not communicate the product.

Every section should answer:

- What is this?
- Why does it matter?
- What value does it show?
- How does it connect to the ERP?

## ERP/SaaS Specific Rules

For Elitium ERP, prefer interfaces that communicate:

- operational control;
- clarity;
- productivity;
- intelligence;
- trust;
- business organization;
- decision support.

When showing product UI, use realistic ERP concepts:

- products;
- inventory;
- orders;
- customers;
- finance;
- production;
- delivery;
- alerts;
- reports;
- AI insights.

Do not create generic startup content if the screen should represent an ERP.

## AI Product UI Rules

When designing AI-related UI, the AI should feel operational and useful.

Good AI features include:

- product performance analysis;
- low stock alerts;
- margin suggestions;
- product recommendations;
- sales insights;
- inventory risk detection;
- next-best-action suggestions;
- simulated assistant responses based on mock data.

Avoid making the AI look like a disconnected chatbot.

The AI should feel integrated into the ERP workflow.

## Implementation Rules for Codex

When using this skill in Codex:

1. Inspect existing files before editing.
2. Identify the components and styles already used.
3. Preserve the project architecture.
4. Avoid large rewrites unless necessary.
5. Do not add dependencies without explaining why.
6. Do not remove existing functionality without justification.
7. Keep code readable and maintainable.
8. Match the current stack and conventions.
9. Prefer small, targeted improvements.
10. After changes, explain what changed and how to test.

## Quality Checklist

Before finishing, verify:

- Does the interface look less generic?
- Is the hierarchy clearer?
- Is spacing improved?
- Does it work at 1920x1080?
- Does the design feel compatible with ERP/SaaS?
- Are cards and metrics meaningful?
- Is the AI UI useful and connected to the product?
- Did we avoid unnecessary dependencies?
- Did we preserve the existing brand?
- Is the code maintainable?