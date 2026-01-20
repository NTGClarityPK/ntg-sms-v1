\# NTG UI/UX Design System



\*\*Version:\*\* 1.0  

\*\*Last Updated:\*\* 2024  

\*\*Purpose:\*\* Standardized design guidelines for all NTG applications



---



\## Table of Contents



1\. \[Core Principles](#core-principles)

2\. \[Theme System](#theme-system)

3\. \[Layout Components](#layout-components)

4\. \[Navigation](#navigation)

5\. \[Data Display](#data-display)

6\. \[Form Components](#form-components)

7\. \[Feedback Components](#feedback-components)

8\. \[Spacing \& Typography](#spacing--typography)

9\. \[RTL Support](#rtl-support)

10\. \[Accessibility](#accessibility)



---



\## Core Principles



\### 1. Theme-First Approach

\- \*\*All colors must come from theme configuration\*\* - Never hardcode colors

\- Single source of truth: `themeConfig.ts`

\- Support light and dark themes

\- Dynamic theme switching without page refresh



\### 2. Consistency

\- Use Mantine UI components as base

\- Apply consistent spacing using Mantine spacing scale

\- Maintain visual hierarchy through typography and color

\- No shadows on cards (except navbar active state)



\### 3. Responsiveness

\- Mobile-first approach

\- Breakpoints: `xs`, `sm`, `md`, `lg`, `xl`

\- Collapsible navigation for mobile



\### 4. Accessibility

\- WCAG 2.1 AA compliance

\- Keyboard navigation support

\- Screen reader friendly

\- High contrast ratios



---



\## Theme System



\### Color Structure



All colors are generated from a primary color and theme mode (light/dark).



\#### Base Colors

\- `primary` - Main brand color

\- `primaryLight` / `primaryLighter` / `primaryLightest` - Lighter variations

\- `primaryDark` / `primaryDarker` / `primaryDarkest` - Darker variations

\- `background` - Page background

\- `surface` - Card/surface background

\- `text` - Primary text color

\- `textSecondary` - Secondary text color

\- `textMuted` - Muted text color

\- `border` - Standard border color

\- `borderLight` - Subtle border color



\#### Component-Specific Colors

Each component has its own color configuration:

\- `navbar.\*` - Navigation sidebar colors

\- `header.\*` - Top header colors

\- `button.\*` - Button colors

\- `table.\*` - Table colors

\- `tabs.\*` - Tab colors

\- `badge.\*` - Badge colors

\- `input.\*` - Input field colors

\- `card.\*` - Card colors



\### Theme Configuration File

Location: `lib/theme/themeConfig.ts`



\*\*Key Rules:\*\*

\- Never hardcode colors in components

\- Always use `generateThemeConfig(primaryColor, isDark)`

\- Access colors via `themeConfig.components.{componentName}.{property}`

\- Use CSS custom properties for dynamic updates



---



\## Layout Components



\### Page Structure



```

┌─────────────────────────────────────┐

│ Header (AppShell.Header)            │

├─────────────────────────────────────┤

│ ┌─────┐ ┌─────────────────────────┐ │

│ │Nav  │ │ Title Bar               │ │

│ │bar  │ ├─────────────────────────┤ │

│ │     │ │ Subtitle Bar (optional)  │ │

│ │     │ ├─────────────────────────┤ │

│ │     │ │ Content Area            │ │

│ │     │ │ (padding: md)            │ │

│ └─────┘ └─────────────────────────┘ │

└─────────────────────────────────────┘

```



\### Title Bar

\- \*\*Height:\*\* 60px (fixed)

\- \*\*Background:\*\* `themeConfig.components.titleBar.backgroundColor`

\- \*\*Padding:\*\* `var(--mantine-spacing-md)` horizontal

\- \*\*Content:\*\* Page title (Title component, order={1})

\- \*\*Alignment:\*\* Left-aligned (LTR), Right-aligned (RTL)



\### Subtitle Bar

\- \*\*Height:\*\* 40px (fixed)

\- \*\*Background:\*\* `themeConfig.components.subTitleBar.backgroundColor`

\- \*\*Optional:\*\* Only shown when needed

\- \*\*Content:\*\* Secondary navigation or filters



\### Content Area

\- \*\*Padding:\*\* 

&nbsp; - Top: `var(--mantine-spacing-sm)`

&nbsp; - Horizontal: `var(--mantine-spacing-md)`

&nbsp; - Bottom: `var(--mantine-spacing-xl)`

\- \*\*Margin Top:\*\* 60px (to account for fixed title bar)

\- \*\*Background:\*\* `themeConfig.components.page.backgroundColor`



---



\## Navigation



\### Sidebar (Navbar)



\#### Dimensions

\- \*\*Expanded Width:\*\* 250px

\- \*\*Collapsed Width:\*\* 85px (accounts for scrollbar)

\- \*\*Height:\*\* Full viewport height

\- \*\*Position:\*\* Fixed left (LTR) / right (RTL)



\#### Structure

```

┌─────────────────┐

│ Section Header   │ (optional)

├─────────────────┤

│ Nav Item 1      │

│ Nav Item 2      │

│ Nav Item 3      │

│ ...             │

├─────────────────┤

│ Toggle Button   │

└─────────────────┘

```



\#### Nav Items



\*\*Expanded State:\*\*

\- \*\*Icon Size:\*\* 24px

\- \*\*Icon Position:\*\* Left side

\- \*\*Text:\*\* Visible, left-aligned

\- \*\*Padding:\*\* `0.5rem 1rem`

\- \*\*Width:\*\* 100%

\- \*\*Font:\*\* `themeConfig.typography.fontFamily.primary`

\- \*\*Font Weight:\*\* Regular (600 when active)



\*\*Collapsed State:\*\*

\- \*\*Icon Size:\*\* 24px (same as expanded)

\- \*\*Icon Position:\*\* Centered

\- \*\*Text:\*\* Hidden (shown in tooltip)

\- \*\*Padding:\*\* `0.75rem`

\- \*\*Width:\*\* Auto (centered)

\- \*\*Tooltip:\*\* Shows on hover



\#### Active State

\- \*\*Background:\*\* `themeConfig.components.navbar.activeBackground`

\- \*\*Text/Icon Color:\*\* `themeConfig.components.navbar.activeTextColor`

\- \*\*Font Weight:\*\* 600 (expanded), 700 (collapsed)

\- \*\*Collapsed Only:\*\*

&nbsp; - Border: 4px solid (left in LTR, right in RTL)

&nbsp; - Border Color: `activeTextColor`

&nbsp; - Box Shadow: `0 2px 8px rgba(0, 0, 0, 0.15)`

&nbsp; - Icon Drop Shadow: `0 2px 4px rgba(0, 0, 0, 0.2)`

&nbsp; - Border Radius: `0 8px 8px 0` (LTR) / `8px 0 0 8px` (RTL)



\#### Hover State

\- \*\*Background:\*\* `themeConfig.components.navbar.hoverBackground`

\- \*\*Text/Icon Color:\*\* `themeConfig.components.navbar.hoverTextColor`

\- \*\*Transition:\*\* `0.2s ease`



\#### Colors

\- \*\*Background:\*\* `themeConfig.components.navbar.backgroundColor`

\- \*\*Text:\*\* `themeConfig.components.navbar.textColor`

\- \*\*Border:\*\* `themeConfig.components.navbar.borderColor` (RTL: none)



\#### Implementation

\- Use `Button` component (not `NavLink`)

\- Use `data-active` and `data-collapsed` attributes for CSS targeting

\- Persist collapsed state in `localStorage`

\- Set `data-navbar-collapsed` on `document.body` for CSS



\### Header



\#### Structure

```

┌─────────────────────────────────────────────────────────┐

│ \[Burger] \[Logo] \[Name]  ... \[NTG Logo] \[Status] \[Lang] \[User] │

└─────────────────────────────────────────────────────────┘

```



\#### Left Side

\- \*\*Burger Menu:\*\* Mobile only (`hiddenFrom="sm"`)

\- \*\*Logo:\*\* 32px × 32px, customer logo or default icon

\- \*\*Name:\*\* Restaurant name (hidden on mobile)

\- \*\*Click Action:\*\* Navigate to dashboard



\#### Right Side

\- \*\*NTG Logo:\*\* 64px × 32px (width: 2× height)

\- \*\*Online Status Badge:\*\* 

&nbsp; - Height: 32px (matches language button)

&nbsp; - Variant: `light`

&nbsp; - Color: `green` (online) / `red` (offline)

&nbsp; - Text: "Online" / "Offline" (hidden on mobile)

&nbsp; - Icon: 8px filled circle

\- \*\*Language Button:\*\* 

&nbsp; - Variant: `subtle`

&nbsp; - Size: `sm`

&nbsp; - Always visible

\- \*\*User Menu:\*\* Avatar with dropdown



\#### Colors

\- \*\*Background:\*\* `themeConfig.components.header.backgroundColor`

\- \*\*Border:\*\* `themeConfig.components.header.borderColor`

\- \*\*Text:\*\* `themeConfig.components.header.textColor`

\- \*\*Height:\*\* 60px



---



\## Data Display



\### Tables



\#### Structure

```tsx

<Table>

&nbsp; <Table.Thead>

&nbsp;   <Table.Tr>

&nbsp;     <Table.Th>Column 1</Table.Th>

&nbsp;     <Table.Th>Column 2</Table.Th>

&nbsp;   </Table.Tr>

&nbsp; </Table.Thead>

&nbsp; <Table.Tbody>

&nbsp;   <Table.Tr>

&nbsp;     <Table.Td>Data 1</Table.Td>

&nbsp;     <Table.Td>Data 2</Table.Td>

&nbsp;   </Table.Tr>

&nbsp; </Table.Tbody>

</Table>

```



\#### Styling

\- \*\*Background:\*\* `themeConfig.components.table.backgroundColor`

\- \*\*Header Background:\*\* `themeConfig.components.table.headerBackground`

\- \*\*Header Hover:\*\* `themeConfig.components.table.headerHoverBackground`

\- \*\*Border Color:\*\* `themeConfig.components.table.borderColor`

\- \*\*Text Color:\*\* `themeConfig.components.table.textColor`

\- \*\*Row Hover:\*\* `themeConfig.components.table.hoverBackground`

\- \*\*Font:\*\* `themeConfig.typography.fontFamily.primary`



\#### Best Practices

\- Always use `Table` component from Mantine

\- Use `Paper` wrapper with `withBorder` for container

\- Add action buttons in last column

\- Use `Badge` for status indicators



\### Cards



\#### Structure

```tsx

<Card shadow={null} withBorder>

&nbsp; <Card.Section>...</Card.Section>

&nbsp; <Text>Content</Text>

</Card>

```



\#### Rules

\- \*\*No shadows\*\* - Use `shadow={null}` or omit `shadow` prop

\- \*\*Border:\*\* Always use `withBorder` prop

\- \*\*Background:\*\* `themeConfig.components.card.backgroundColor`

\- \*\*Border Color:\*\* `themeConfig.components.card.borderColor`

\- \*\*Padding:\*\* Use Mantine spacing (`p="md"`, `p="sm"`, etc.)



\#### Card Sections

\- Use `Card.Section` for images or headers

\- Images should use `cover` fit and be centered

\- Square images: Use `Box` wrapper with fixed dimensions



\### Badges



\#### Variant

Always use `variant="light"` for theme-aware styling.



\#### Color Rules

\- \*\*Light Theme:\*\* Light background, dark text

\- \*\*Dark Theme:\*\* Dark background, light text

\- Colors generated from `themeConfig.components.badge.\*`



\#### Usage

```tsx

<Badge variant="light" color={statusColor}>

&nbsp; {statusText}

</Badge>

```



\#### Examples

\- Order status (paid/unpaid)

\- Item status (active/inactive)

\- Delivery status

\- Payment status

\- Table status



\### Chips (Filter Capsules)



\#### Structure

```tsx

<Group gap="xs" wrap="wrap" className="filter-chip-group">

&nbsp; <Chip

&nbsp;   checked={selected === null}

&nbsp;   onChange={() => onSelect(null)}

&nbsp;   variant="filled"

&nbsp; >

&nbsp;   All Categories

&nbsp; </Chip>

&nbsp; <Chip.Group value={selected} onChange={onSelect}>

&nbsp;   {items.map(item => (

&nbsp;     <Chip key={item.id} value={item.id} variant="filled">

&nbsp;       {item.name}

&nbsp;     </Chip>

&nbsp;   ))}

&nbsp; </Chip.Group>

</Group>

```



\#### Styling

\- \*\*Background:\*\* `themeConfig.components.filterChip.backgroundColor`

\- \*\*Text:\*\* `themeConfig.components.filterChip.textColor`

\- \*\*Selected Background:\*\* `themeConfig.components.filterChip.selectedBackgroundColor`

\- \*\*Selected Text:\*\* `themeConfig.components.filterChip.selectedTextColor`

\- \*\*Border Radius:\*\* 20px

\- \*\*Gap:\*\* `var(--mantine-spacing-xs)`



\#### Wrapper

\- Wrap in `Paper` with `p="sm"` and `withBorder`

\- Use `Group` with `wrap="wrap"` to prevent line breaks

\- Class name: `filter-chip-group` for CSS targeting



---



\## Form Components



\### Buttons



\#### Primary Button

```tsx

<Button

&nbsp; leftSection={<IconPlus size={16} />}

&nbsp; onClick={handleClick}

>

&nbsp; Add Item

</Button>

```



\- \*\*Variant:\*\* `filled` (default)

\- \*\*Background:\*\* `themeConfig.components.button.backgroundColor`

\- \*\*Text:\*\* `themeConfig.components.button.textColor`

\- \*\*Hover:\*\* `themeConfig.components.button.hoverColor`

\- \*\*Font:\*\* `themeConfig.typography.fontFamily.primary`

\- \*\*Font Weight:\*\* `themeConfig.typography.fontWeight.medium`



\#### Secondary Button

```tsx

<Button variant="light" color={primaryColor}>

&nbsp; Cancel

</Button>

```



\#### Action Buttons (Icon Only)

```tsx

<ActionIcon

&nbsp; variant="subtle"

&nbsp; onClick={handleEdit}

>

&nbsp; <IconEdit size={16} />

</ActionIcon>

```



\- \*\*Size:\*\* Usually `16px` or `20px` icons

\- \*\*Background:\*\* Transparent

\- \*\*Hover:\*\* `themeConfig.components.button.hoverColor`

\- \*\*Color:\*\* `themeConfig.components.button.textColor`



\#### Button Groups in Title Bar

\- Align with page content, not header buttons

\- Use `Group` with conditional padding:

&nbsp; - LTR: `paddingRight: 'var(--mantine-spacing-md)'`

&nbsp; - RTL: `paddingLeft: 'var(--mantine-spacing-md)'`



\### Inputs



\#### Text Input

```tsx

<TextInput

&nbsp; label="Name"

&nbsp; placeholder="Enter name"

&nbsp; {...form.getInputProps('name')}

/>

```



\- \*\*Background:\*\* `themeConfig.components.input.backgroundColor`

\- \*\*Border:\*\* `themeConfig.components.input.borderColor`

\- \*\*Text:\*\* `themeConfig.components.input.textColor`

\- \*\*Focus Border:\*\* `themeConfig.colors.primary`



\#### Select

```tsx

<Select

&nbsp; label="Category"

&nbsp; data={options}

&nbsp; {...form.getInputProps('category')}

/>

```



Same styling as TextInput.



\### Tabs



\#### Structure

```tsx

<Tabs value={activeTab} onChange={setActiveTab}>

&nbsp; <Tabs.List>

&nbsp;   <Tabs.Tab value="tab1" leftSection={<Icon size={16} />}>

&nbsp;     Tab 1

&nbsp;   </Tabs.Tab>

&nbsp;   <Tabs.Tab value="tab2">Tab 2</Tabs.Tab>

&nbsp; </Tabs.List>

&nbsp; <Tabs.Panel value="tab1" pt="md" px="md" pb="md">

&nbsp;   Content

&nbsp; </Tabs.Panel>

</Tabs>

```



\#### Styling

\- \*\*Background:\*\* `themeConfig.components.tabs.backgroundColor`

\- \*\*Border:\*\* `themeConfig.components.tabs.borderColor`

\- \*\*Border Radius:\*\* 8px (all corners)

\- \*\*Tab Text:\*\* `themeConfig.components.tabs.textColor`

\- \*\*Selected Tab Background:\*\* `themeConfig.components.tabs.selectedTabBackgroundColor`

\- \*\*Selected Tab Text:\*\* `themeConfig.components.tabs.selectedTabFontColor`

\- \*\*Hover Background:\*\* `themeConfig.components.tabs.hoverTabBackgroundColor`

\- \*\*Hover Text:\*\* `themeConfig.components.tabs.hoverTabFontColor`



\#### Panel Padding

\- \*\*Top:\*\* `var(--mantine-spacing-md)`

\- \*\*Horizontal:\*\* `var(--mantine-spacing-md)`

\- \*\*Bottom:\*\* `var(--mantine-spacing-md)`



---



\## Feedback Components



\### Modals



\#### Structure

```tsx

<Modal

&nbsp; opened={opened}

&nbsp; onClose={onClose}

&nbsp; title="Modal Title"

&nbsp; size="md"

>

&nbsp; <form onSubmit={handleSubmit}>

&nbsp;   {/\* Form content \*/}

&nbsp;   <Group justify="flex-end" mt="md">

&nbsp;     <Button variant="subtle" onClick={onClose}>

&nbsp;       Cancel

&nbsp;     </Button>

&nbsp;     <Button type="submit">

&nbsp;       Save

&nbsp;     </Button>

&nbsp;   </Group>

&nbsp; </form>

</Modal>

```



\#### Sizes

\- `xs` - Small forms

\- `sm` - Medium forms

\- `md` - Large forms (default)

\- `lg` - Extra large

\- `xl` - Full screen



\### Notifications



Use Mantine notifications with theme colors:

```tsx

notifications.show({

&nbsp; title: 'Success',

&nbsp; message: 'Item saved',

&nbsp; color: successColor,

});

```



\### Alerts



```tsx

<Alert icon={<IconAlertCircle size={16} />} color={errorColor}>

&nbsp; Error message

</Alert>

```



---



\## Spacing \& Typography



\### Spacing Scale

Use Mantine spacing tokens:

\- `xs` - 10px

\- `sm` - 12px

\- `md` - 16px

\- `lg` - 20px

\- `xl` - 32px



\### Typography



\#### Font Families

\- \*\*Primary:\*\* `themeConfig.typography.fontFamily.primary` (body text)

\- \*\*Heading:\*\* `themeConfig.typography.fontFamily.heading` (titles)

\- \*\*Mono:\*\* `themeConfig.typography.fontFamily.mono` (code)



\#### Font Sizes

\- \*\*xs:\*\* `themeConfig.typography.fontSize.xs`

\- \*\*sm:\*\* `themeConfig.typography.fontSize.sm`

\- \*\*md:\*\* `themeConfig.typography.fontSize.md`

\- \*\*lg:\*\* `themeConfig.typography.fontSize.lg`

\- \*\*xl:\*\* `themeConfig.typography.fontSize.xl`



\#### Font Weights

\- \*\*Regular:\*\* `themeConfig.typography.fontWeight.regular` (400)

\- \*\*Medium:\*\* `themeConfig.typography.fontWeight.medium` (500)

\- \*\*Semibold:\*\* `themeConfig.typography.fontWeight.semibold` (600)

\- \*\*Bold:\*\* `themeConfig.typography.fontWeight.bold` (700)



\#### Headings

\- \*\*Page Title (H1):\*\* `Title order={1}` - Uses `themeConfig.typography.titleSize.h1`

\- \*\*Section Title (H2):\*\* `Title order={2}` - Uses `themeConfig.typography.titleSize.h2`

\- \*\*Subsection Title (H3):\*\* `Title order={3}` - Uses `themeConfig.typography.titleSize.h3`



\#### Text Colors

\- \*\*Primary:\*\* `themeConfig.colors.text`

\- \*\*Secondary:\*\* `themeConfig.colors.textSecondary`

\- \*\*Muted:\*\* `themeConfig.colors.textMuted`

\- \*\*Page Header:\*\* `themeConfig.typography.pageHeaderColor`

\- \*\*Section Header:\*\* `themeConfig.typography.pageSectionHeaderColor`



---



\## RTL Support



\### Layout Adjustments



\#### Navbar

\- \*\*Active Border:\*\* Right side in RTL (instead of left)

\- \*\*Border Radius:\*\* `8px 0 0 8px` in RTL (instead of `0 8px 8px 0`)

\- \*\*Chevron Direction:\*\* Reversed in RTL

\- \*\*No Border:\*\* Remove border in RTL (`border-right: none`)



\#### Header

\- \*\*Logo Position:\*\* Right side in RTL

\- \*\*Actions:\*\* Left side in RTL



\#### Content Alignment

\- \*\*Text:\*\* Automatically handled by `dir="rtl"` attribute

\- \*\*Buttons:\*\* Use conditional padding:

&nbsp; ```tsx

&nbsp; <Group style={{

&nbsp;   paddingRight: dir === 'rtl' ? 0 : 'var(--mantine-spacing-md)',

&nbsp;   paddingLeft: dir === 'rtl' ? 'var(--mantine-spacing-md)' : 0,

&nbsp; }}>

&nbsp; ```



\#### Title Bar Buttons

\- Align with page content, not header buttons

\- CSS handles alignment via `.page-title-bar .mantine-Group-root`



\### Implementation

\- Set `dir="rtl"` on `html` element for Arabic

\- Use `html\[dir="rtl"]` in CSS selectors

\- Test all components in both LTR and RTL



---



\## Accessibility



\### Color Contrast

\- \*\*Text on Background:\*\* Minimum 4.5:1 ratio (WCAG AA)

\- \*\*Large Text:\*\* Minimum 3:1 ratio

\- \*\*Interactive Elements:\*\* Clear focus indicators



\### Keyboard Navigation

\- All interactive elements must be keyboard accessible

\- Tab order should be logical

\- Focus indicators visible



\### Screen Readers

\- Use semantic HTML

\- Provide `aria-label` for icon-only buttons

\- Use `alt` text for images

\- Proper heading hierarchy



\### Disabled States

\- \*\*Opacity:\*\* `themeConfig.components.button.disabledOpacity` (0.38)

\- Clear visual indication

\- Prevent interaction



---



\## Component Checklist



When creating a new component, ensure:



\- \[ ] All colors come from `themeConfig`

\- \[ ] No hardcoded colors

\- \[ ] Supports light and dark themes

\- \[ ] RTL compatible

\- \[ ] Responsive (mobile-friendly)

\- \[ ] Keyboard accessible

\- \[ ] Proper spacing using Mantine tokens

\- \[ ] Uses appropriate Mantine components

\- \[ ] No shadows on cards (unless specified)

\- \[ ] Badges use `variant="light"`

\- \[ ] Consistent typography

\- \[ ] Proper focus states

\- \[ ] Loading states handled

\- \[ ] Error states handled



---



\## Common Patterns



\### Page Layout

```tsx

<>

&nbsp; <div className="page-title-bar">

&nbsp;   <Title order={1}>Page Title</Title>

&nbsp;   <Group>

&nbsp;     <Button>Action</Button>

&nbsp;   </Group>

&nbsp; </div>

&nbsp; <div className="page-sub-title-bar">

&nbsp;   {/\* Optional subtitle content \*/}

&nbsp; </div>

&nbsp; <div style={{

&nbsp;   marginTop: '60px',

&nbsp;   paddingLeft: 'var(--mantine-spacing-md)',

&nbsp;   paddingRight: 'var(--mantine-spacing-md)',

&nbsp;   paddingTop: 'var(--mantine-spacing-sm)',

&nbsp;   paddingBottom: 'var(--mantine-spacing-xl)',

&nbsp; }}>

&nbsp;   {/\* Page content \*/}

&nbsp; </div>

</>

```



\### Table with Actions

```tsx

<Paper p="md" withBorder>

&nbsp; <Table>

&nbsp;   <Table.Thead>

&nbsp;     <Table.Tr>

&nbsp;       <Table.Th>Name</Table.Th>

&nbsp;       <Table.Th>Status</Table.Th>

&nbsp;       <Table.Th>Actions</Table.Th>

&nbsp;     </Table.Tr>

&nbsp;   </Table.Thead>

&nbsp;   <Table.Tbody>

&nbsp;     {items.map(item => (

&nbsp;       <Table.Tr key={item.id}>

&nbsp;         <Table.Td>{item.name}</Table.Td>

&nbsp;         <Table.Td>

&nbsp;           <Badge variant="light">{item.status}</Badge>

&nbsp;         </Table.Td>

&nbsp;         <Table.Td>

&nbsp;           <Group gap="xs">

&nbsp;             <ActionIcon onClick={() => handleEdit(item)}>

&nbsp;               <IconEdit size={16} />

&nbsp;             </ActionIcon>

&nbsp;             <ActionIcon onClick={() => handleDelete(item)}>

&nbsp;               <IconTrash size={16} />

&nbsp;             </ActionIcon>

&nbsp;           </Group>

&nbsp;         </Table.Td>

&nbsp;       </Table.Tr>

&nbsp;     ))}

&nbsp;   </Table.Tbody>

&nbsp; </Table>

</Paper>

```



\### Form with Save Button

```tsx

<form onSubmit={handleSubmit}>

&nbsp; <Stack gap="md">

&nbsp;   <TextInput label="Name" {...form.getInputProps('name')} />

&nbsp;   <Select label="Category" data={categories} {...form.getInputProps('category')} />

&nbsp; </Stack>

&nbsp; <Group

&nbsp;   justify="flex-end"

&nbsp;   mt="md"

&nbsp;   style={{

&nbsp;     paddingRight: dir === 'rtl' ? 0 : 'var(--mantine-spacing-md)',

&nbsp;     paddingLeft: dir === 'rtl' ? 'var(--mantine-spacing-md)' : 0,

&nbsp;   }}

&nbsp; >

&nbsp;   <Button type="submit">Save Changes</Button>

&nbsp; </Group>

</form>

```



---



\## File Structure



```

lib/

&nbsp; theme/

&nbsp;   themeConfig.ts          # Theme configuration

&nbsp;   createDynamicTheme.ts   # Mantine theme creation

&nbsp; utils/

&nbsp;   themeColors.ts          # Color generation utilities

&nbsp; hooks/

&nbsp;   use-theme.ts            # Theme mode hook

&nbsp;   use-theme-color.ts      # Primary color hook

&nbsp;   use-chart-colors.ts     # Chart colors hook

&nbsp;   use-chart-tooltip.ts    # Chart tooltip styles hook

components/

&nbsp; providers/

&nbsp;   DynamicThemeProvider.tsx  # CSS injection and theme application

&nbsp; layout/

&nbsp;   Sidebar.tsx              # Navigation sidebar

&nbsp;   Header.tsx               # Top header

```



---



\## Version History



\- \*\*v1.0\*\* (2024) - Initial design system documentation



---



\*\*Note:\*\* This document should be updated whenever new patterns or components are introduced. All developers and AI assistants should reference this document when building UI components.





