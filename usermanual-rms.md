# User Manual

Complete user manual for restaurant owners and staff using the NTG Restaurant Management System.

## 🎯 Introduction

Welcome to the NTG Restaurant Management System! This manual will guide you through using the system for your restaurant operations.

### Who This Manual Is For

**Restaurant Owners:**

* 🏢 **Tenant Owners** - Restaurant owners who sign up and manage their restaurant

**Restaurant Staff:**

* 💳 **Cashiers** - Processing orders and payments
* 🍳 **Kitchen Staff** - Managing order preparation
* 🍽️ **Waiters** - Taking and serving orders
* 👔 **Managers** - Overseeing operations and reports
* 🚚 **Delivery Personnel** - Managing deliveries

### System Overview

The system helps you manage:

* 🏢 Restaurant and branch setup
* 📋 Orders and payments
* 🍕 Menu items
* 📦 Inventory
* 👥 Customers and employees
* 🚚 Deliveries
* 📊 Reports and analytics
* ⚙️ Settings and configuration

***

## 🏢 For Restaurant Owners

### 🚀 Getting Started - Sign Up

#### Creating Your Restaurant Account

**Steps:**

1. Navigate to the signup page
2. Fill in restaurant information:
   * **Email** - Your email address (used for login)
   * **Password** - Create a secure password
   * **Restaurant Name** - Your restaurant name
   * **Subdomain** - Unique identifier (e.g., "myrestaurant")
3. Click **Sign Up**
4. Account created successfully!

**After Signup:**

* You'll be logged in automatically
* You'll see the setup wizard
* Complete initial configuration

**Sign up with Google:**\
You can also sign up using **Sign in with Google**. When you do, a new restaurant (tenant) is created and you will be asked for restaurant setup information (e.g. **currency**, restaurant name, and other settings). You become the owner of that restaurant.

**Login with Google:**\
If you **log in** with Google:

* If your email is already in the system (e.g. you are a chef, cashier, or staff in a restaurant), you will be logged into the **correct restaurant** with your **correct role**.
* If your email is not in any restaurant, you will be **redirected to the signup screen** to create a new restaurant and complete setup.

{% @mermaid/diagram content="graph LR
A\[Sign Up] --> B\[Account Created]
B --> C\[Setup Wizard]
C --> D\[Restaurant Info]
C --> E\[First Branch]
C --> F\[Initial Settings]
D --> G\[Ready to Use]
E --> G
F --> G" %}

***

### 🏗️ Initial Setup

#### Step 1: Restaurant Information

**Steps:**

1. Go to **Restaurant** → **Information**
2. Fill in details:
   * **Restaurant Name** (English and Arabic)
   * **Phone** - Contact number
   * **Email** - Restaurant email
   * **Logo** - Upload restaurant logo
   * **Primary Color** - Brand color (hex code)
   * **Default Currency** - e.g., IQD, USD
   * **Timezone** - Your timezone
   * **VAT Number** - Tax identification (optional)
3. Click **Save**

**Branding:**

* Upload logo (recommended size: 200x200px)
* Set primary color for theme
* Logo appears on receipts and invoices

#### Step 2: Create Your First Branch

**Steps:**

1. Go to **Restaurant** → **Branches**
2. Click **Add Branch**
3. Fill in branch details:
   * **Branch Name** (English and Arabic)
   * **Branch Code** - Unique code (e.g., "BR001")
   * **Address** (English and Arabic)
   * **City** - City name
   * **State** - State/Province
   * **Country** - Country
   * **Phone** - Branch phone
   * **Email** - Branch email
   * **Location** - Latitude and longitude (optional)
   * **Manager** - Assign branch manager (optional)
4. Click **Save**

**Branch Setup:**

* Create at least one branch to start
* You can add more branches later
* Each branch operates independently

#### Step 3: Setup Tables (For Dine-In)

**Steps:**

1. Go to **Restaurant** → **Tables**
2. Click **Add Table**
3. Fill in:
   * **Table Number** - Table identifier
   * **Branch** - Select branch
   * **Seating Capacity** - Number of seats
   * **Table Type** - Regular, VIP, Outdoor (optional)
4. Click **Save**

**Table Management:**

* Create tables for dine-in service
* Track table status (Available, Occupied)
* Assign orders to tables

#### Step 4: Configure Taxes

**Steps:**

1. Go to **Settings** → **Taxes**
2. Click **Add Tax**
3. Fill in:
   * **Tax Name** - e.g., "VAT", "Service Charge"
   * **Tax Rate** - Percentage (e.g., 10%)
   * **Active** - Enable/disable
4. Click **Save**

**Tax Configuration:**

* Add all applicable taxes
* Taxes are automatically calculated on orders
* Can be applied per order

***

### 🏢 Restaurant Management

#### Managing Restaurant Information

**Update Restaurant Info:**

1. Go to **Restaurant** → **Information**
2. Edit any field:
   * Name
   * Contact information
   * Logo
   * Colors
   * Currency
   * Timezone
3. Click **Save**

**Upload Logo:**

1. Click **Upload Logo**
2. Select image file
3. Crop/resize if needed
4. Save
5. Logo updates across system

#### Managing Branches

**Add New Branch:**

1. Go to **Restaurant** → **Branches**
2. Click **Add Branch**
3. Fill in branch details
4. Save

**Edit Branch:**

1. Click on branch
2. Edit information
3. Update manager assignment
4. Save changes

**Deactivate Branch:**

1. Open branch
2. Toggle **Active** status
3. Branch deactivated
4. Can be reactivated later

**Branch Features:**

* Multiple branches supported
* Independent operations
* Branch-specific settings
* Cross-branch reporting

#### Managing Tables

**Add Table:**

1. Go to **Restaurant** → **Tables**
2. Click **Add Table**
3. Enter table number
4. Set capacity
5. Select branch
6. Save

**Table Management:**

* Create tables for dine-in
* Set seating capacity
* Track table status

**Table Statuses:**

* 🟢 **Available** - Ready for customers
* 🔵 **Occupied** - Currently in use

**Releasing tables:**\
Once an order is marked **Served**, the table is **released automatically after 1 hour**. You can also **release the table manually** at any time (e.g. when the customer leaves early). After release, the table shows as Available again.

***

### 👥 Employee Management (For Owners)

#### Creating Employees

**Steps:**

1. Go to **Employees**
2. Click **Add Employee**
3. Fill in employee details:
   * **Email** - Employee email (for login)
   * **Name** (English and Arabic)
   * **Phone** - Contact number
   * **Role** - Select role:
     * Manager
     * Cashier
     * Kitchen Staff
     * Waiter
     * Delivery
   * **Employee ID** - Unique identifier
   * **Branches** - Assign to branches
   * **Employment Details** - Type, joining date, salary
4. Click **Save**

**Employee Roles:**

* **Manager** - Full branch access
* **Cashier** - POS operations
* **Kitchen Staff** - Kitchen display access
* **Waiter** - Order management
* **Delivery** - Delivery management

#### Managing Employees

**View Employees:**

* List all employees
* Filter by role
* Filter by branch
* Search by name or email

**Edit Employee:**

1. Click on employee
2. Update information
3. Change role (if needed)
4. Update branch assignments
5. Save

**Deactivate Employee:**

1. Open employee profile
2. Toggle **Active** status
3. Employee deactivated
4. Can be reactivated later

**Employee Access:**

* Employees receive login credentials
* Access based on role (see [Dynamic Roles & RBAC](#security-and-access-control) section)
* Branch-specific access
* Permission-based features
* Role access can be customized via **Settings → Role Access**

***

### 🍕 Menu Setup (For Owners)

#### Initial Menu Configuration

**Step 1: Create Categories**

1. Go to **Menu** → **Categories**
2. Click **Add Category**
3. Enter:
   * Category name (English and Arabic)
   * Description
   * Category type (Food, Beverage, Dessert)
   * Image (optional)
4. Save

**Step 2: Add Food Items**

1. Go to **Menu** → **Food Items**
2. Click **Add Food Item**
3. Fill in:
   * Name (English and Arabic)
   * Description
   * Category
   * Base price
   * Image
   * Stock type
4. Save

**Step 3: Setup Variations** (Optional)

1. Go to **Menu** → **Variation Groups**
2. Create variation groups (e.g., "Size")
3. Add variations to items (e.g., Small, Medium, Large)

**Step 4: Setup Add-Ons** (Optional)

1. Go to **Menu** → **Add-On Groups**
2. Create add-on groups (e.g., "Extras")
3. Add add-ons (e.g., Extra Cheese, Pepperoni)

**Bulk Import:**

* Import menu from Excel/CSV
* Saves time for large menus
* See [Menu Management Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/menu-management)

***

### ⚙️ Settings Configuration

#### General Settings

**Access Settings:**

1. Go to **Settings**
2. View all settings categories
3. Edit as needed

**Settings Categories:**

**Restaurant Settings:**

* Restaurant information
* Branding (logo, colors)
* Currency and timezone
* Contact information

**Branch Settings:**

* Branch-specific settings
* Branch preferences

**Tax Settings:**

* Tax rates
* Tax configuration
* Tax application rules

**Language Settings:**

* Active languages
* Default language
* Translation management

**Theme Settings:**

* Color scheme
* Logo
* Display preferences

**Role Access Settings:**

* Configure role access configurations
* Manage which tabs/pages each role can access
* Enable/disable kitchen display per role
* See [Dynamic Roles & RBAC](#security-and-access-control) section for details

#### Updating Settings

**Steps:**

1. Go to **Settings**
2. Select category
3. Edit values
4. Click **Save**
5. Changes apply immediately

**Settings Apply To:**

* All users (for tenant settings)
* Specific branch (for branch settings)

***

### 📊 Reports & Analytics (For Owners)

#### Dashboard Overview

**Key Metrics:**

* 💰 Total revenue (all branches)
* 📋 Total orders
* 📈 Revenue trends
* 👥 Customer count
* 📦 Inventory status

**Branch Comparison:**

* Compare branch performance
* Revenue by branch
* Orders by branch
* Performance metrics

#### Financial Reports

**Revenue Reports:**

* Total revenue
* Revenue by period
* Revenue by branch
* Revenue trends
* Growth analysis

**Profit Analysis:**

* Cost analysis
* Profit margins
* Expense tracking
* Financial overview

#### Operational Reports

**Sales Reports:**

* Sales by period
* Sales by branch
* Sales by item
* Sales trends

**Order Reports:**

* Orders by status
* Orders by type
* Order trends
* Order efficiency

**Employee Reports:**

* Employee performance
* Sales by employee
* Activity reports

***

### 🌐 Multi-Language Setup

#### Activating Languages

**Steps:**

1. Go to **Settings** → **Languages**
2. View available languages:
   * 🇬🇧 English (en)
   * 🇸🇦 Arabic (ar)
   * 🇫🇷 French (fr)
   * 🇮🇶 Kurdish (ku)
3. Toggle languages **Active**
4. Set **Default Language**
5. Save

**Language Features:**

* Automatic translations via AI
* Manual translation editing
* Language-specific content
* Customer language preferences

#### Managing Translations

**Automatic Translations:**

* Translations generated automatically
* Uses Google Gemini AI
* Covers menu items, categories, etc.

**Manual Translation:**

1. Go to **Translations**
2. Select entity (e.g., Food Item)
3. Edit translations
4. Save

**Translation Status:**

* View translation status
* Identify missing translations
* Retranslate if needed

***

### 🎨 Theme Customization

#### Customizing Appearance

**Steps:**

1. Go to **Settings** → **Theme**
2. Configure:
   * **Primary Color** - Main brand color
   * **Logo** - Restaurant logo
   * **Display Settings** - UI preferences
3. Save

**Theme Features:**

* Custom colors
* Branded interface
* Logo on receipts
* Consistent branding

***

### 🔐 Security & Access Control

#### Understanding Dynamic Roles & RBAC

The NTG Restaurant Management System uses a **Dynamic Role-Based Access Control (RBAC)** system that allows you to customize what each role can access. Unlike fixed roles, you can configure which pages, features, and actions each role can use.

**How RBAC Works:**

{% @mermaid/diagram content="graph TB
A\[User Login] --> B\[User Roles]
B --> C\[Role Access Configuration]
C --> D\[Accessible Tabs/Pages]
C --> E\[Feature Permissions]
D --> F\[Can Access Page?]
E --> G\[Can Perform Action?]
F --> H{Yes}
F --> I{No}
H --> J\[Show Page]
I --> K\[Hide/Block Page]
G --> L{Yes}
G --> M{No}
L --> N\[Allow Action]
M --> O\[Deny Action]" %}

**Two-Tier Access Control:**

1. **Tab/Path Access Control** - Controls which pages are visible and accessible
2. **Permission-Based Access** - Controls specific actions within accessible pages

#### Managing Role Access Configurations

**Accessing Role Access Settings:**

1. Go to **Settings** → **Role Access**
2. View all available roles and their current configurations
3. Click on a role to edit its access configuration

**Configuring Role Access:**

**Steps:**

1. Navigate to **Settings** → **Role Access**
2. Select the role you want to configure (e.g., Cashier, Kitchen Staff, Waiter)
3. Configure **Accessible Tabs**:
   * Check/uncheck tabs to allow or restrict access
   * Available tabs include:
     * Dashboard
     * POS
     * Orders
     * Menu
     * Inventory
     * Recipes
     * Employees
     * Customers
     * Delivery
     * Coupons
     * Reports
     * Settings
4. Configure **Kitchen Display**:
   * Enable/disable kitchen display button visibility
   * Useful for kitchen staff and managers
5. Click **Save**
6. Changes apply immediately to all users with that role

**Example Configurations:**

**Cashier Role:**

* ✅ Dashboard
* ✅ POS
* ✅ Orders
* ✅ Customers
* ✅ Kitchen Display (to view orders)

**Kitchen Staff Role:**

* ✅ Dashboard
* ✅ Orders
* ✅ Menu
* ✅ Inventory
* ✅ Recipes
* ✅ Kitchen Display

**Waiter Role:**

* ✅ Dashboard
* ✅ POS
* ✅ Orders
* ✅ Customers
* ✅ Kitchen Display

#### Default Role Configurations

When you first set up your restaurant, default role configurations are automatically created:

| Role              | Default Accessible Tabs                     | Kitchen Display |
| ----------------- | ------------------------------------------- | --------------- |
| **Manager**       | All tabs (full access)                      | ✅ Enabled       |
| **Tenant Owner**  | All tabs (full access)                      | ✅ Enabled       |
| **Cashier**       | Dashboard, POS, Orders, Customers           | ✅ Enabled       |
| **Kitchen Staff** | Dashboard, Orders, Menu, Inventory, Recipes | ✅ Enabled       |
| **Waiter**        | Dashboard, POS, Orders, Customers           | ✅ Enabled       |
| **Delivery**      | Dashboard, Delivery, Customers              | ✅ Enabled       |

**Important Notes:**

* Default configurations can be modified at any time
* Managers and Tenant Owners have full access by default
* You can create custom access configurations for any role
* Changes apply to all users with that role immediately

#### Multiple Roles & Permission Union

**Employees with Multiple Roles:**

If an employee has multiple roles assigned:

* Access is granted if **any** role allows it (union of permissions)
* Example: If a user has both "Cashier" and "Waiter" roles:
  * They get access to all tabs that either role allows
  * If Cashier allows POS and Waiter allows Delivery, user gets both

**Best Practice:**

* Assign only necessary roles to employees
* Review role assignments regularly
* Use specific roles rather than multiple roles when possible

#### Managing User Access

**Role Assignment:**

1. Go to **Employees**
2. Select an employee
3. Edit employee details
4. Assign one or more roles:
   * Manager
   * Cashier
   * Kitchen Staff
   * Waiter
   * Delivery
5. Save changes

**Role Assignment Best Practices:**

* Assign roles based on job responsibilities
* Don't assign unnecessary roles
* Review role assignments periodically
* Remove roles when employees change positions

**Permission Levels:**

The system uses different permission levels:

* **Full Access** - Owner/Manager (all features)
* **Limited Access** - Staff roles (configured access)
* **View-Only Access** - Read-only access to specific features
* **Custom Permissions** - Granular control per role

#### Access Control Examples

**Scenario 1: Restricting Cashier Access**

**Goal:** Cashiers should only access POS, Orders, and Customers (no Reports or Settings)

**Steps:**

1. Go to **Settings** → **Role Access**
2. Select **Cashier** role
3. Uncheck:
   * Reports
   * Settings
   * Menu (if you want menu only via POS)
   * Inventory
4. Keep checked:
   * Dashboard
   * POS
   * Orders
   * Customers
5. Save

**Result:** Cashiers can only see and access Dashboard, POS, Orders, and Customers tabs.

**Scenario 2: Custom Kitchen Staff Access**

**Goal:** Kitchen staff need Menu and Inventory access but not Recipes

**Steps:**

1. Go to **Settings** → **Role Access**
2. Select **Kitchen Staff** role
3. Uncheck:
   * Recipes
4. Keep checked:
   * Dashboard
   * Orders
   * Menu
   * Inventory
5. Save

**Result:** Kitchen staff can access Menu and Inventory but not Recipes.

**Scenario 3: Manager with Restricted Access**

**Goal:** Create a branch manager with limited access (no Settings)

**Steps:**

1. Create a custom role or modify Manager role
2. Go to **Settings** → **Role Access**
3. Select **Manager** role (or create new role)
4. Uncheck:
   * Settings
5. Keep all other tabs checked
6. Save

**Result:** Manager can access all features except Settings.

#### Viewing Current Access

**For Employees:**

Employees can see their accessible tabs in the sidebar:

* Only tabs they have access to are visible
* Blocked tabs are hidden automatically
* Access is checked in real-time

**For Managers/Owners:**

1. Go to **Settings** → **Role Access**
2. View all roles and their configurations
3. See which tabs each role can access
4. Identify any access issues

#### Troubleshooting Access Issues

**Employee Cannot Access a Page:**

1. Check employee's assigned roles:
   * Go to **Employees** → Select employee → View roles
2. Check role access configuration:
   * Go to **Settings** → **Role Access** → Select role
   * Verify the page/tab is checked
3. If employee has multiple roles:
   * Check if any role allows access
   * Access is granted if any role allows it
4. Update role configuration if needed
5. Refresh employee's browser

**Employee Sees Too Many Tabs:**

1. Go to **Settings** → **Role Access**
2. Select the employee's role
3. Review accessible tabs
4. Uncheck unnecessary tabs
5. Save changes
6. Employee will see updated access immediately

**Changes Not Applying:**

1. Verify changes were saved
2. Ask employee to refresh browser
3. Check if employee has multiple roles (union applies)
4. Verify employee is assigned the correct role
5. Clear browser cache if needed

#### Account Security

**Password Management:**

* Strong password requirements
* Regular password changes
* Password reset functionality

**Session Management:**

* Auto-logout after inactivity
* Secure session handling
* Activity logging

#### Security Best Practices

**Role Management:**

1. **Principle of Least Privilege** - Grant minimum necessary access
2. **Regular Audits** - Review role assignments quarterly
3. **Role Separation** - Use specific roles rather than multiple roles
4. **Access Documentation** - Document custom role configurations
5. **Employee Changes** - Update roles when employees change positions

**Access Control:**

1. **Test Configurations** - Test role access after changes
2. **Monitor Access** - Review who has access to sensitive features
3. **Limit Settings Access** - Restrict Settings access to managers only
4. **Regular Reviews** - Review role access configurations regularly
5. **Documentation** - Keep notes on custom role configurations

***

### 📋 Initial Setup Checklist

**Complete Setup Checklist:**

**Restaurant Setup:**

* [ ] Restaurant information entered
* [ ] Logo uploaded
* [ ] Brand colors set
* [ ] Currency configured
* [ ] Timezone set

**Branch Setup:**

* [ ] First branch created
* [ ] Branch information complete
* [ ] Tables created (if dine-in)

**Menu Setup:**

* [ ] Categories created
* [ ] Food items added
* [ ] Variations configured (if needed)
* [ ] Add-ons configured (if needed)
* [ ] Prices set

**Staff Setup:**

* [ ] Employees created
* [ ] Roles assigned
* [ ] Branch assignments made
* [ ] Login credentials shared

**Configuration:**

* [ ] Taxes configured
* [ ] Settings reviewed
* [ ] Languages activated
* [ ] Theme customized

**Testing:**

* [ ] Test order creation
* [ ] Test payment processing
* [ ] Test kitchen display
* [ ] Test reports

***

### 🎓 Owner Training Guide

#### Week 1: Setup

**Day 1-2:**

* Complete signup
* Enter restaurant information
* Create first branch
* Setup tables

**Day 3-4:**

* Add menu items
* Configure categories
* Setup variations and add-ons
* Test menu display

**Day 5-7:**

* Create employees
* Assign roles
* Configure settings
* Test system

#### Week 2: Operations

**Daily Operations:**

* Process orders
* Manage inventory
* Track sales
* Review reports

**Ongoing:**

* Monitor performance
* Update menu
* Manage staff
* Review analytics

***

***

## 👨‍💼 For Restaurant Staff

### 🚀 Getting Started

### First Time Login

1. Open your web browser
2. Navigate to your restaurant's URL
3. Enter your **email** and **password** (provided by owner/manager), or click **Sign in with Google**
4. Click **Login**

**Sign in with Google:**\
If you use **Sign in with Google** and your email is already in the system (e.g. you are staff in a restaurant), you will be logged into the correct restaurant with your role. If your email is not in any restaurant, you will be redirected to the signup screen.

**Forgot Password?**

1. Click **Forgot Password**
2. Enter your email
3. Check your email for reset instructions
4. Follow the link to reset your password
5. Contact manager if you don't receive email

### Dashboard Overview

After logging in, you'll see the **Dashboard**:

{% @mermaid/diagram content="graph TB
A\[Dashboard] --> B\[Quick Stats]
A --> C\[Recent Orders]
A --> D\[Top Items]
A --> E\[Sales Chart]

```
B --> F[Total Revenue]
B --> G[Today's Orders]
B --> H[Pending Orders]" %}
```

**Dashboard Cards:**

* 💰 **Total Revenue** - Total sales amount
* 📋 **Total Orders** - Number of orders
* ⏱️ **Pending Orders** - Orders awaiting preparation
* 📊 **Average Order Value** - Average order amount

### Navigation

**Main Menu:**

* 🏠 **Dashboard** - Overview and statistics
* 📋 **Orders** - View and manage orders
* 💳 **POS** - Point of Sale system
* 🍕 **Menu** - Manage menu items
* 📦 **Inventory** - Stock management
* 👥 **Employees** - Staff management
* 👤 **Customers** - Customer database
* 🚚 **Delivery** - Delivery management
* 📊 **Reports** - Analytics and reports
* ⚙️ **Settings** - System settings

**Quick Actions:**

* Use keyboard shortcuts for faster navigation
* Search bar for quick access

***

## 💳 Point of Sale (POS)

### Creating a New Order

**Step-by-Step:**

1. **Navigate to POS**
   * Click **POS** in the main menu
   * Select your **Branch**
2. **Select Order Type**
   * **Dine-In** - Customer dining in
   * **Takeaway** - Customer picking up
   * **Delivery** - Home delivery
3. **For Dine-In Orders:**
   * Select **Table** number
   * Table status updates automatically
4. **Add Items to Cart**
   * Browse menu by category
   * Click on food item
   * Select **Variations** (size, flavor, etc.)
   * Add **Add-Ons** (extras, toppings)
   * Set **Quantity**
   * Add **Special Instructions** (optional)
   * Click **Add to Cart**
5. **Review Cart**
   * Check items and quantities
   * Verify prices
   * Apply **Coupon** (optional)
   * Review **Total**
6. **Select Customer** (optional)
   * Search existing customer
   * Or create new customer
   * Or proceed as **Guest**
7. **Payment Timing**
   * **Pay After** - Pay when order is ready (common for dine-in)
   * **Pay First** - Pay immediately (common for takeaway/delivery)
8. **Create Order**
   * Click **Create Order**
   * Order number generated
   * Receipt displayed (optional print)

### POS Features

**Cart Management:**

* ➕ Add items
* ➖ Remove items
* ✏️ Edit quantities
* 🔄 Update variations/add-ons
* 💬 Add special instructions

**Pricing:**

* Automatic price calculation
* Variations add to price
* Add-ons add to price
* Taxes calculated automatically
* Discounts applied

**Customer Selection:**

* Quick customer search
* Create new customer on the fly
* Guest checkout option
* Customer history access

### Processing Payments

**Steps:**

1. Open order from **Orders** list
2. Click **Process Payment**
3. Select **Payment Method**:
   * Cash
   * Card
4. Enter **Amount** (if partial payment)
5. Click **Confirm Payment**
6. Print receipt (optional)

**Payment Status:**

* 🟡 **Unpaid** - Payment pending
* 🟢 **Paid** - Payment completed

***

## 📋 Order Management

### Viewing Orders

**Order List:**

* All orders displayed in a table
* Filter by:
  * **Status** (Pending, Preparing, Ready, etc.)
  * **Type** (Dine-in, Takeaway, Delivery)
  * **Branch**
  * **Date Range**
  * **Payment Status**
* Search by:
  * Order number
  * Customer name
  * Token number
  * Phone number

**Order Details:**

* Click on any order to view details
* See all items
* View customer information
* Check payment status
* View order timeline

### Order Statuses

**Order Status Flow:**

{% @mermaid/diagram content="graph LR
A\[Pending] --> B\[Preparing]
B --> C\[Ready]
C --> D\[Served]
D --> E\[Completed]

```
A --> F[Cancelled]
B --> F" %}
```

**Status Meanings:**

* 🟡 **Pending** - Order placed, awaiting kitchen
* 🔵 **Preparing** - Being prepared in kitchen
* 🟢 **Ready** - Ready for pickup/serving
* ✅ **Served** - Served to customer (for dine-in, the table is auto-released after 1 hour or can be released manually)
* ✔️ **Completed** - Order completed
* ❌ **Cancelled** - Order cancelled

### Updating Order Status

**From Orders Page:**

1. Open order
2. Click **Status** button
3. Select new status
4. Status updates automatically

**From Kitchen Display:**

1. View order in KDS
2. Click status button
3. Select new status
4. All connected devices update

### Modifying Orders

* ✅ Add items
* ✅ Remove items
* ✅ Update quantities
* ✅ Change table (dine-in)
* ✅ Modify special instructions

**After Completion:**

* ❌ Cannot modify completed orders

***

## 🍳 Kitchen Display System (KDS)

### Accessing KDS

1. Navigate to **Orders** → **Kitchen**
2. KDS displays automatically
3. Full-screen mode available

### KDS Features

**Order Display:**

* Orders appear instantly when created
* Color-coded by status
* Sound alerts for new orders
* Auto-refresh

**Order Information:**

* Order number
* Table number (dine-in)
* Token number (takeaway)
* Items list
* Quantities
* Special instructions
* Order time

### Updating Order Status

**Order Level:**

1. Click on order card
2. Click **Status** button
3. Select:
   * Preparing
   * Ready
   * Served

**Item Level:**

1. Click on specific item
2. Update item status individually
3. Useful for multi-item orders

**Quick Actions:**

* Mark as Ready
* Mark as Served
* View order details
* Print order slip

### Filtering Orders

**Filter Options:**

* By **Status** (Pending, Preparing, Ready)
* By **Order Type** (Dine-in, Takeaway, Delivery)
* By **Time** (Today, Last hour, Custom)
* By **Table** (for dine-in)

***

## 🍕 Menu Management

### Viewing Menu

**Menu Structure:**

* Categories (Main Courses, Beverages, etc.)
* Food Items within categories
* Variations (sizes, options)
* Add-ons (extras)

**Navigation:**

1. Go to **Menu**
2. Browse by category
3. Click category to expand
4. View items in category

### Adding Items to Order

**From POS:**

1. Select category
2. Click food item
3. Choose variations (if any)
4. Select add-ons (if any)
5. Set quantity
6. Add to cart

**Item Details:**

* Item name and description
* Price
* Image
* Available variations
* Available add-ons
* Stock status

***

## 📦 Inventory Management

### Viewing Stock Levels

**Steps:**

1. Navigate to **Inventory** → **Ingredients**
2. View ingredient list
3. Check **Current Stock**
4. See **Low Stock** alerts

**Stock Information:**

* Ingredient name
* Current quantity
* Unit of measurement
* Minimum threshold
* Stock status (Normal/Low/Out)

**Actions:**

* Review low stock items
* Schedule purchases
* Update stock levels

### Recording Stock Transactions

**Adding Stock (Purchase):**

1. Go to **Inventory** → **Stock Management**
2. Select ingredient
3. Click **Add Stock**
4. Enter:
   * Quantity received
   * Unit cost
   * Supplier name
   * Invoice number
   * Branch
5. Click **Save**

**Adjusting Stock:**

1. Select ingredient
2. Click **Adjust Stock**
3. Enter new quantity
4. Add reason
5. Save

***

## 👤 Customer Management

### Searching Customers

**Search Methods:**

* By **Name**
* By **Phone** number
* By **Email**
* By **Order** number

**Steps:**

1. Go to **Customers**
2. Use search bar
3. Results appear instantly
4. Click customer to view details

### Viewing Customer Details

**Customer Information:**

* Personal details (name, phone, email)
* Address information
* Order history
* Total orders
* Total spent
* Last order date

### Creating New Customer

**Quick Create (from POS):**

1. In POS, click **Select Customer**
2. Click **New Customer**
3. Enter:
   * Name
   * Phone (required)
   * Email (optional)
   * Address (for delivery)
4. Save

**From Customers Page:**

1. Go to **Customers**
2. Click **Add Customer**
3. Fill in details
4. Save

***

## 🚚 Delivery Management

### Viewing Deliveries

**Delivery List:**

* All delivery orders
* Filter by status
* Filter by branch
* Filter by date

**Delivery Statuses:**

* 🟡 **Pending** - Awaiting assignment
* 🔵 **Assigned** - Delivery person assigned
* 🟠 **Out for Delivery** - On the way
* 🟢 **Delivered** - Delivered
* ❌ **Cancelled** - Cancelled

### Assigning Deliveries

**Steps:**

1. Go to **Delivery**
2. Find **Pending** delivery
3. Click **Assign**
4. Select **Delivery Person**
5. Add notes (optional)
6. Confirm assignment

### Updating Delivery Status

**Steps:**

1. Open delivery order
2. Click **Update Status**
3. Select new status:
   * Out for Delivery
   * Delivered
   * Cancelled
4. Add notes (optional)
5. Save

***

## 📊 Reports & Analytics

### Viewing Reports

**Access Reports:**

1. Navigate to **Reports**
2. Select report type
3. Set date range
4. Apply filters
5. View results

### Available Reports

**Sales Report:**

* Revenue by period
* Orders by date
* Sales trends
* Revenue breakdown

**Order Report:**

* Order details
* Order status breakdown
* Orders by type
* Order trends

**Inventory Report:**

* Stock levels
* Low stock items
* Stock transactions
* Usage analysis

**Customer Report:**

* Customer list
* Customer spending
* Order frequency
* Customer segments

**Financial Report:**

* Total revenue
* Revenue by period
* Cost analysis
* Profit margins

### Exporting Reports

**Export Options:**

1. Click **Export** button
2. Choose format:
   * PDF
   * Excel
   * CSV
3. Download file

***

## ⚙️ Settings & Configuration

### Profile Settings

**Update Profile:**

1. Click **Profile** (top right)
2. Edit information:
   * Name
   * Email
   * Phone
   * Photo
3. Save changes

**Change Password:**

1. Go to **Profile**
2. Click **Change Password**
3. Enter current password
4. Enter new password
5. Confirm new password
6. Save

### Branch Selection

**Switch Branch:**

1. Click **Branch** selector (top bar)
2. Select branch
3. System switches to selected branch
4. Data filtered by branch

### Language Selection

**Change Language:**

1. Click **Language** selector (top bar)
2. Select language:
   * 🇬🇧 English
   * 🇸🇦 Arabic
   * 🇫🇷 French
   * 🇮🇶 Kurdish
3. Interface updates immediately

***

## 🎫 Coupon Management (For Owners)

### Creating Coupons

**Steps:**

1. Go to **Coupons** (or **Settings** → **Coupons**)
2. Click **Add Coupon**
3. Fill in coupon details:
   * **Coupon Code** - Unique code (e.g., "SAVE10", "WELCOME5")
   * **Discount Type**:
     * **Percentage** - Percentage off (e.g., 10%)
     * **Fixed Amount** - Fixed discount (e.g., $5)
   * **Discount Value** - Amount or percentage
   * **Minimum Order Amount** - Minimum order to use coupon (optional)
   * **Maximum Discount** - Maximum discount amount (for percentage coupons, optional)
   * **Usage Limit** - Maximum number of times coupon can be used (optional)
   * **Valid From** - Start date (optional)
   * **Valid Until** - End date (optional)
   * **Active** - Enable/disable coupon
   * **Branch** - Apply to specific branch or all branches (optional)
4. Click **Save**

**Coupon Examples:**

**Percentage Coupon:**

* Code: "SAVE10"
* Type: Percentage
* Value: 10%
* Max Discount: $20
* Min Order: $50

**Fixed Amount Coupon:**

* Code: "WELCOME5"
* Type: Fixed
* Value: $5
* Min Order: $25

### Managing Coupons

**View All Coupons:**

1. Go to **Coupons**
2. View coupon list:
   * Coupon code
   * Discount type and value
   * Usage count
   * Status (Active/Inactive)
   * Validity period

**Edit Coupon:**

1. Click on coupon
2. Update any field
3. Save changes

**Deactivate Coupon:**

1. Open coupon
2. Toggle **Active** status
3. Coupon deactivated
4. Can be reactivated later

**Delete Coupon:**

1. Open coupon
2. Click **Delete**
3. Confirm deletion
4. Coupon soft-deleted (can be restored)

### Coupon Settings

**Discount Types:**

**Percentage Discount:**

* Discount calculated as percentage of order total
* Can set maximum discount limit
* Example: 10% off up to $20

**Fixed Amount Discount:**

* Fixed discount amount
* Applied directly to order total
* Example: $5 off

**Validity Period:**

* Set start and end dates
* Coupon only valid during period
* Leave empty for no expiry

**Usage Limits:**

* Set maximum usage count
* Track usage automatically
* Disable when limit reached

**Minimum Order Amount:**

* Require minimum order value
* Coupon only applies if order meets minimum
* Useful for encouraging larger orders

**Branch-Specific Coupons:**

* Create coupons for specific branches
* Or create for all branches
* Useful for location-specific promotions

## 🎫 Applying Coupons (For Staff)

### Applying Coupons in POS

**Steps:**

1. Add items to cart
2. Click **Apply Coupon**
3. Enter coupon code
4. System validates coupon:
   * Checks if code exists
   * Verifies validity period
   * Checks usage limit
   * Verifies minimum order amount
5. Discount applied automatically
6. Total updated

**Coupon Validation:**

* Code must be valid
* Must meet minimum order amount
* Must be within validity period
* Usage limit checked
* Coupon must be active

**Coupon Types:**

* **Percentage** - e.g., 10% off
* **Fixed Amount** - e.g., $5 off

**Removing Coupon:**

1. Click **Remove Coupon** in cart
2. Discount removed
3. Total recalculated

***

## 🔍 Common Tasks

### Daily Opening Checklist

1. ✅ Login to system
2. ✅ Select branch
3. ✅ Check dashboard for pending items
4. ✅ Review low stock alerts
5. ✅ Check today's schedule
6. ✅ Verify POS is ready

### Taking a Dine-In Order

1. Customer seated at table
2. Open **POS**
3. Select **Dine-In**
4. Select **Table** number
5. Add items to cart
6. Review order
7. Create order (Pay After)
8. Order sent to kitchen
9. Serve when ready
10. Process payment when customer finishes

### Processing Takeaway Order

1. Customer orders
2. Open **POS**
3. Select **Takeaway**
4. Add items to cart
5. Apply coupon (if any)
6. Process payment (Pay First)
7. Create order
8. Assign token number
9. Notify customer when ready

### Handling Delivery Order

1. Customer calls/orders online
2. Open **POS**
3. Select **Delivery**
4. Select or create customer
5. Verify delivery address
6. Add items to cart
7. Process payment
8. Create order
9. Assign delivery person
10. Track delivery status

### End of Day Tasks

1. ✅ Review all orders
2. ✅ Process pending payments
3. ✅ Check delivery statuses
4. ✅ Review daily reports
5. ✅ Export reports if needed
6. ✅ Logout

***

## 🆘 Troubleshooting

### Common Issues

**Cannot Login:**

* Verify email and password
* Check internet connection
* Contact administrator if locked out

**Order Not Appearing in Kitchen:**

* Check order status
* Refresh kitchen display
* Verify order was created
* Check branch selection

**Payment Not Processing:**

* Verify payment method
* Check order total
* Ensure order is not already paid
* Try refreshing page

**Stock Not Updating:**

* Check if stock transaction was saved
* Verify ingredient selection
* Check branch selection
* Refresh inventory page

**Customer Not Found:**

* Check spelling
* Try phone number search
* Create new customer if needed

### Getting Help

**Support Options:**

* Check this manual
* Contact your manager
* Contact system administrator
* Review help tooltips in system

***

## 💡 Tips & Best Practices

### Order Management

1. **Accuracy First** - Double-check items before creating order
2. **Status Updates** - Update order status promptly
3. **Communication** - Communicate delays to customers
4. **Payment Tracking** - Track payment status accurately

### Customer Service

1. **Quick Search** - Use customer search for faster checkout
2. **Customer History** - Review past orders for preferences
3. **Special Instructions** - Always note special requests
4. **Follow Up** - Check on customers during service

### Inventory Management

1. **Regular Checks** - Check stock levels regularly
2. **Low Stock Alerts** - Act on low stock alerts promptly
3. **Accurate Recording** - Record all stock transactions accurately
4. **Supplier Info** - Maintain supplier information

### Efficiency Tips

1. **Quick Actions** - Use quick action buttons
2. **Filters** - Use filters to find items faster
3. **Search** - Use search instead of scrolling

***

## 📱 Mobile Usage

### Mobile Browser Access

The system works on mobile devices:

* Open browser on phone/tablet
* Navigate to restaurant URL
* Login with credentials
* Full functionality available

### Mobile Optimized Features

* Touch-friendly interface
* Responsive design
* Quick actions
* Mobile-optimized forms

***

## 🔐 Security

### Account Security

**Password Guidelines:**

* Use strong passwords
* Don't share passwords
* Change password regularly
* Logout when done

**Session Management:**

* System auto-logs out after inactivity
* Always logout when leaving station
* Don't leave system unattended

### PIN Authentication

PIN authentication provides a quick and secure way to log in to the system without entering your full email and password each time. The PIN is stored securely on your device and encrypted.

**Setting Up PIN Authentication:**

1. Log in with your email and password
2. Go to **Settings** → **Profile**
3. Scroll to **PIN Settings** section
4. Click **Setup PIN**
5. Enter a 4-6 digit PIN (numbers only)
6. Confirm your PIN
7. Read and accept the privacy notice
8. Click **Setup PIN**

**Using PIN to Log In:**

1. On the login page, if PIN is set up, you'll see a PIN option
2. Enter your PIN (4-6 digits)
3. System authenticates using your stored credentials
4. You're logged in instantly

**PIN Security Features:**

* 🔒 **Encrypted Storage** - PIN data is encrypted on your device
* 👤 **User-Specific** - Each user's PIN is separate
* 📱 **Device-Specific** - PIN is tied to your device
* 🔑 **No Personal Data** - Only encrypted tokens are stored locally
* 🛡️ **Secure Encryption** - Uses industry-standard encryption (AES-GCM)

**Managing PIN:**

**Remove PIN:**

1. Go to **Settings** → **Profile**
2. Scroll to **PIN Settings**
3. Click **Remove PIN**
4. Confirm removal
5. PIN is deleted from your device

**PIN Requirements:**

* Must be 4-6 digits
* Numbers only (0-9)
* Cannot be shared between users
* Stored only on your device

**Privacy Notice:**

* PIN data is stored locally on your device only
* No PIN information is sent to servers
* Only encrypted authentication tokens are stored
* You can remove PIN at any time
* PIN is device-specific and user-specific

**Troubleshooting PIN:**

**PIN Not Working:**

* Verify you're entering the correct PIN
* Ensure you're using the same device where PIN was set up
* Try logging in with email/password, then re-setup PIN

**Forgot PIN:**

* Use email/password login instead
* Go to Settings → Profile → PIN Settings
* Remove old PIN and set up a new one

**PIN Not Available:**

* PIN is only available after initial email/password login
* Ensure you're logged in before setting up PIN
* Check that your browser supports local storage

### Data Privacy

* Customer data is confidential
* Don't share customer information
* Follow privacy policies
* Report security concerns

***

## 📞 Quick Reference

### Order Statuses

| Status    | Meaning              | Action               |
| --------- | -------------------- | -------------------- |
| Pending   | Awaiting preparation | Start preparing      |
| Preparing | Being prepared       | Continue preparation |
| Ready     | Ready to serve       | Serve to customer    |
| Served    | Served               | Complete order       |
| Completed | Order done           | Archive              |
| Cancelled | Order cancelled      | No action            |

### Payment Statuses

| Status | Meaning          | Action           |
| ------ | ---------------- | ---------------- |
| Unpaid | Payment pending  | Process payment  |
| Paid   | Payment received | No action needed |

### Delivery Statuses

| Status           | Meaning                  | Action                 |
| ---------------- | ------------------------ | ---------------------- |
| Pending          | Awaiting assignment      | Assign delivery person |
| Assigned         | Delivery person assigned | Start delivery         |
| Out for Delivery | On the way               | Track delivery         |
| Delivered        | Delivered                | Confirm delivery       |
| Cancelled        | Cancelled                | No action              |

***

## 🎓 Training Resources

### For New Users

1. **Read This Manual** - Start here
2. **Practice Mode** - Use test data to practice
3. **Shadow Experienced Staff** - Learn from others
4. **Ask Questions** - Don't hesitate to ask

### Role-Specific Guides

**Cashiers:**

* Focus on POS section
* Payment processing
* Customer management
* Receipt printing

**Kitchen Staff:**

* Focus on Kitchen Display System
* Order status updates
* Item status management

**Waiters:**

* Focus on Orders section
* Table management
* Order status updates
* Customer service

**Managers:**

* Focus on Reports
* Employee management
* Settings
* Analytics

***

## 📝 Notes

* System saves automatically
* Changes are logged
* History is maintained
* Data is backed up regularly

***

**Need Help?** Contact your manager or system administrator.

**Last Updated:** 2024

***

## 📚 Additional Resources

### For Restaurant Owners

* [Menu Management Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/menu-management) - Complete menu setup guide
* [Employee Management Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/employees) - Staff management
* [Reports & Analytics Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/reports) - Business insights

### For Restaurant Staff

* [Order Management Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/orders) - Order processing
* [Inventory Management Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/inventory) - Stock management
* [Customer Management Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/customers) - Customer database
* [Delivery Management Guide](https://ntgclarity-1.gitbook.io/ntg-resto-user-docs/table-of-contents/features/delivery) - Delivery operations