# Ghost Settings UI Profile Implementation Plan

## Overview

This document outlines the implementation plan for updating the Ghost Settings UI to support profile selection and custom profile creation. The goal is to provide users with an intuitive interface to choose between pre-made profiles and create their own custom Ghost profiles.

## Current System Analysis

### Existing Components

- **GhostServiceSettings.tsx**: React component for Ghost settings UI
- **GhostProfileManager.ts**: Backend profile management with 4 default profiles
- **GhostProfile.ts**: Profile data structure and configuration
- **GhostServiceSettings type**: Zod schema for settings validation

### Current UI Structure

```
Ghost Settings
├── Triggers Section
│   ├── Pause to Complete (enableAutoTrigger)
│   ├── Auto Trigger Delay (autoTriggerDelay)
│   ├── Quick Task Keybinding (enableQuickInlineTaskKeybinding)
│   └── Smart Inline Task Keybinding (enableSmartInlineTaskKeybinding)
└── Advanced Settings (Collapsible)
    └── Provider Section
        ├── Use custom provider (enableCustomProvider)
        └── API Configuration (apiConfigId) - when custom enabled
```

### Existing Default Profiles

1. **Mercury Coder**: `inception/mercury-coder` with Mercury strategy (default)
2. **FIM Coder**: `qwen/qwen-2.5-7b-instruct` with Fill-in-Middle strategy
3. **Hole Filler**: `openai/gpt-4o-mini` with Hole Filler strategy
4. **Legacy XML**: `anthropic/claude-3.5-sonnet` with Legacy XML strategy

## Implementation Plan

### Phase 1: Type System Updates

#### 1.1 Update GhostServiceSettings Schema

**File**: `packages/types/src/kilocode.ts`

Add new fields to `ghostServiceSettingsSchema`:

```typescript
export const ghostServiceSettingsSchema = z
	.object({
		// Existing fields...
		enableAutoTrigger: z.boolean().optional(),
		autoTriggerDelay: z.number().min(1).max(30).default(3).optional(),
		enableQuickInlineTaskKeybinding: z.boolean().optional(),
		enableSmartInlineTaskKeybinding: z.boolean().optional(),
		enableCustomProvider: z.boolean().optional(),
		apiConfigId: z.string().optional(),
		showGutterAnimation: z.boolean().optional(),

		// New profile selection fields
		selectedProfileId: z.string().optional(),
		usePreMadeProfiles: z.boolean().default(true).optional(),
	})
	.optional()
```

**Migration Strategy**:

- Default `usePreMadeProfiles` to `true` for existing users
- Default `selectedProfileId` to `"mercury-coder"` (current default)
- Maintain backward compatibility with `enableCustomProvider`

### Phase 2: UI Component Updates

#### 2.1 Update GhostServiceSettings Component

**File**: `webview-ui/src/components/kilocode/settings/GhostServiceSettings.tsx`

**New UI Structure**:

```
Ghost Settings
├── Triggers Section (unchanged)
└── Advanced Settings (Collapsible)
    ├── Profile Selection Section (NEW)
    │   ├── Profile Mode Toggle (Pre-made vs Custom)
    │   ├── Pre-made Profile Dropdown (when Pre-made selected)
    │   │   ├── Mercury Coder (default)
    │   │   ├── FIM Coder
    │   │   ├── Hole Filler
    │   │   └── Legacy XML
    │   └── Custom Profile Management (when Custom selected)
    │       ├── Create New Profile Button
    │       ├── Custom Profile Dropdown
    │       └── Edit/Delete Profile Actions
    └── Provider Section (legacy, hidden when using pre-made profiles)
```

**Component Changes**:

1. Add profile mode toggle (radio buttons or toggle switch)
2. Add pre-made profile dropdown with descriptions
3. Add custom profile management section
4. Conditionally show legacy provider settings
5. Add profile information display (model, strategy, description)

#### 2.2 Create Profile Management Components

**New Components to Create**:

1. **ProfileSelector.tsx**

    - Dropdown for selecting pre-made profiles
    - Display profile information (name, description, model, strategy)
    - Handle profile selection changes

2. **CustomProfileManager.tsx**

    - List existing custom profiles
    - Create new profile button
    - Edit/delete profile actions
    - Profile validation and error handling

3. **ProfileCreationModal.tsx**

    - Modal for creating/editing custom profiles
    - API profile selection dropdown
    - Strategy selection dropdown
    - Custom settings configuration
    - Profile name and description inputs
    - Validation and preview

4. **ProfileInfoCard.tsx**
    - Display profile details (model, strategy, performance metrics)
    - Show profile status (active, error, loading)
    - Quick actions (edit, delete, set as default)

### Phase 3: Backend Integration

#### 3.1 Update Extension State Management

**File**: `webview-ui/src/context/ExtensionStateContext.tsx`

Add new state fields:

```typescript
interface ExtensionState {
	// Existing fields...
	ghostServiceSettings?: GhostServiceSettings

	// New profile-related fields
	availableGhostProfiles?: GhostProfileSummary[]
	selectedGhostProfile?: GhostProfileSummary
	customGhostProfiles?: GhostProfileConfig[]
}
```

Add new actions:

```typescript
interface ExtensionStateContextType {
	// Existing actions...
	setGhostServiceSettings: (value: GhostServiceSettings) => void

	// New profile actions
	loadGhostProfiles: () => void
	createGhostProfile: (config: GhostProfileConfig) => Promise<void>
	updateGhostProfile: (id: string, updates: Partial<GhostProfileConfig>) => Promise<void>
	deleteGhostProfile: (id: string) => Promise<void>
	selectGhostProfile: (id: string) => void
}
```

#### 3.2 Add VSCode Extension Message Handlers

**File**: `src/extension.ts` (or relevant message handler)

Add new message types:

```typescript
type WebviewMessage =
	// Existing messages...
	| { type: "loadGhostProfiles" }
	| { type: "createGhostProfile"; config: GhostProfileConfig }
	| { type: "updateGhostProfile"; id: string; updates: Partial<GhostProfileConfig> }
	| { type: "deleteGhostProfile"; id: string }
	| { type: "selectGhostProfile"; id: string }
```

#### 3.3 Update GhostProvider Integration

**File**: `src/services/ghost/GhostProvider.ts`

Update to use selected profile:

```typescript
class GhostProvider {
	private async loadProfileFromSettings(settings: GhostServiceSettings): Promise<void> {
		if (settings.usePreMadeProfiles && settings.selectedProfileId) {
			// Load pre-made profile
			const profile = this.profileManager.getProfile(settings.selectedProfileId)
			if (profile) {
				await this.model.loadProfile(profile)
				return
			}
		}

		// Fallback to legacy custom provider logic
		if (settings.enableCustomProvider) {
			// Existing custom provider logic
		}

		// Default to Mercury Coder profile
		const defaultProfile = this.profileManager.getDefaultProfile()
		if (defaultProfile) {
			await this.model.loadProfile(defaultProfile)
		}
	}
}
```

### Phase 4: Internationalization

#### 4.1 Add Translation Keys

**File**: `webview-ui/src/i18n/locales/en/kilocode.json`

Add new translation keys under `ghost.settings`:

```json
{
	"ghost": {
		"settings": {
			// Existing keys...

			"profileSelection": {
				"title": "Profile Selection",
				"description": "Choose how to configure Ghost autocomplete behavior",
				"mode": {
					"preMade": "Use pre-made profiles",
					"custom": "Use custom profiles"
				},
				"preMadeProfiles": {
					"title": "Pre-made Profiles",
					"description": "Select from optimized profile configurations",
					"mercuryCoder": {
						"name": "Mercury Coder",
						"description": "Specialized Mercury Coder model with optimized diff-based prompting"
					},
					"fimCoder": {
						"name": "Code Model FIM",
						"description": "Qwen 2.5-7B-Instruct with native fill-in-middle tokens (fast, non-thinking)"
					},
					"holeFiller": {
						"name": "Chat Model Completion",
						"description": "GPT-4o mini with hole-filler prompting for chat models"
					},
					"legacyXml": {
						"name": "Legacy XML Format",
						"description": "Traditional XML-based prompting with Claude 3.5 Sonnet"
					}
				},
				"customProfiles": {
					"title": "Custom Profiles",
					"description": "Create and manage your own profile configurations",
					"createNew": "Create New Profile",
					"noProfiles": "No custom profiles created yet",
					"actions": {
						"edit": "Edit Profile",
						"delete": "Delete Profile",
						"setDefault": "Set as Default"
					}
				}
			},
			"profileCreation": {
				"title": "Create Ghost Profile",
				"editTitle": "Edit Ghost Profile",
				"fields": {
					"name": {
						"label": "Profile Name",
						"placeholder": "My Custom Profile"
					},
					"description": {
						"label": "Description",
						"placeholder": "Describe this profile's purpose and configuration"
					},
					"apiProfile": {
						"label": "API Configuration",
						"description": "Select which API configuration to use"
					},
					"strategy": {
						"label": "Prompt Strategy",
						"description": "Choose how prompts are generated and responses are parsed"
					},
					"customSettings": {
						"label": "Custom Settings",
						"description": "Override model or other API settings"
					}
				},
				"strategies": {
					"mercury": {
						"name": "Mercury Coder",
						"description": "Mercury Coder prompting with markdown parsing"
					},
					"fim": {
						"name": "Fill-in-Middle",
						"description": "Code model completion using native FIM tokens"
					},
					"holeFiller": {
						"name": "Hole Filler",
						"description": "Chat model completion using hole-filler prompting"
					},
					"legacyXml": {
						"name": "Legacy XML",
						"description": "Traditional XML-based prompting"
					}
				},
				"actions": {
					"create": "Create Profile",
					"update": "Update Profile",
					"cancel": "Cancel",
					"preview": "Preview Configuration"
				}
			}
		}
	}
}
```

### Phase 5: Validation and Error Handling

#### 5.1 Profile Validation

- Validate profile names are unique
- Ensure API profiles exist and are accessible
- Validate strategy types are supported
- Check custom settings are valid for selected API profile

#### 5.2 Error States

- Handle missing API profiles gracefully
- Show error states for failed profile loading
- Provide fallback to default profile on errors
- Display user-friendly error messages

#### 5.3 Loading States

- Show loading indicators during profile operations
- Disable UI during async operations
- Provide progress feedback for long operations

### Phase 6: Testing Strategy

#### 6.1 Unit Tests

- Test profile selection logic
- Test profile creation/editing validation
- Test settings migration and backward compatibility
- Test error handling and edge cases

#### 6.2 Integration Tests

- Test full profile selection workflow
- Test custom profile creation end-to-end
- Test profile switching and persistence
- Test UI state management

#### 6.3 User Acceptance Testing

- Test with existing users (backward compatibility)
- Test profile creation workflow usability
- Test profile selection performance
- Gather feedback on UI/UX improvements

## Migration Strategy

### Backward Compatibility

1. **Existing Users**: Automatically migrate to "Mercury Coder" pre-made profile
2. **Custom Provider Users**: Maintain existing behavior with legacy settings
3. **Settings Migration**: Convert `enableCustomProvider` to appropriate profile selection

### Rollout Plan

1. **Phase 1**: Backend profile system (already complete)
2. **Phase 2**: Basic profile selection UI (pre-made profiles only)
3. **Phase 3**: Custom profile creation UI
4. **Phase 4**: Advanced features (profile import/export, sharing)

## Technical Considerations

### Performance

- Lazy load profile information to avoid startup delays
- Cache profile configurations in extension state
- Debounce profile switching to avoid rapid API calls

### Accessibility

- Ensure all UI components are keyboard navigable
- Provide proper ARIA labels and descriptions
- Support screen readers for profile information

### Extensibility

- Design profile system to support future strategy types
- Allow for plugin-based profile extensions
- Support profile templates and sharing

## Success Metrics

### User Experience

- Reduced time to configure Ghost autocomplete
- Increased adoption of different completion strategies
- Positive user feedback on profile management

### Technical

- Successful migration of existing users
- No performance regression in Ghost system
- Maintainable and extensible codebase

## Future Enhancements

### Profile Sharing

- Export/import profile configurations
- Community profile marketplace
- Organization-wide profile templates

### Advanced Configuration

- Per-language profile selection
- Context-aware profile switching
- Performance-based profile recommendations

### Analytics Integration

- Track profile usage patterns
- Measure completion quality by profile
- Optimize default profile recommendations

## Implementation Timeline

### Week 1-2: Foundation

- Update type system and schemas
- Create basic UI components
- Implement backend message handlers

### Week 3-4: Core Features

- Complete profile selection UI
- Implement custom profile creation
- Add validation and error handling

### Week 5-6: Polish and Testing

- Add comprehensive testing
- Implement migration logic
- UI/UX refinements and accessibility

### Week 7: Release Preparation

- Documentation updates
- Final testing and bug fixes
- Release preparation and rollout planning

This plan provides a comprehensive roadmap for implementing Ghost Settings UI profile selection while maintaining backward compatibility and providing a superior user experience.
