# LuxWin Mobile Frontend UI

A complete mobile-first UI for a color prediction betting app built with pure HTML, CSS, and vanilla JavaScript.

## 🎮 Features

### Screens Included:
- **Authentication**: Login & Register pages
- **Home/Game**: Live game interface with countdown timer
- **Account Dashboard**: User profile and menu options
- **Wallet**: Balance display and transaction history
- **Add Funds**: USDT deposit interface
- **Withdraw**: Withdrawal form with password protection
- **Transactions**: Filterable transaction history
- **Bet History**: Detailed betting records
- **Security**: Password management
- **Promotions**: Referral program with commission tracking
- **Support**: Contact options

## 🚀 Getting Started

### Quick Start
Simply open `index.html` in your web browser:
```bash
cd frontend
open index.html
```

Or use a local server:
```bash
# Python
python -m http.server 8000

# Node.js (http-server)
npx http-server

# VS Code Live Server extension
Right-click index.html → Open with Live Server
```

Then navigate to `http://localhost:8000`

## 🎨 Design System

### Colors
- **Primary Purple**: `#8b5cf6`
- **Dark Purple**: `#6d28d9`
- **Neon Purple**: `#c084fc`
- **Green**: `#10b981` (wins/money)
- **Red**: `#ef4444` (losses/logout)

### Visual Style
- Purple galaxy/space gradient background
- Glassmorphism cards with backdrop blur
- Neon glow borders (`rgba(139, 92, 246, 0.3)`)
- Rounded corners (12-20px)
- Soft shadows and hover effects

### Mobile Optimized
- Responsive design: 360-420px width
- Touch-friendly buttons and interactions
- Bottom navigation bar
- Smooth transitions

## 📁 File Structure

```
frontend/
├── index.html          # Main HTML file (all screens)
├── style.css           # Complete stylesheet
├── app.js             # Navigation & interactions
└── assets/
    ├── icons/         # Icon assets (placeholder)
    └── images/        # Image assets (placeholder)
```

## 🎯 Features

### Navigation
- Bottom tab bar with 4 sections: Home, Game, Win, My
- Back button navigation on detail pages
- Smooth screen transitions

### Interactive Elements
- **Color/Number Selection**: Click to select betting options
- **Copy Buttons**: One-click copy for addresses and codes
- **Tab Switching**: Filter transactions and commission levels
- **Modal Popup**: Auto-display on promotions page
- **Countdown Timer**: Live countdown on game screen
- **Notifications**: Toast-style feedback messages

### Visual Feedback
- Hover effects on all interactive elements
- Active states for selected options
- Loading animations (when needed)
- Smooth transitions and animations

## 🔧 Customization

### Changing Colors
Edit the CSS variables in `style.css`:
```css
:root {
    --primary-purple: #8b5cf6;
    --green: #10b981;
    --red: #ef4444;
    /* ... more variables */
}
```

### Adding Screens
1. Add new screen div in `index.html`:
```html
<div id="new-screen" class="screen">
    <!-- Your content -->
</div>
```

2. Navigate to it using:
```javascript
navigateTo('new-screen');
```

## 📱 Screens Overview

### 1. Authentication
- Clean glass card design
- Email/password fields
- Separate withdrawal password on register

### 2. Home/Game
- Round ID display
- Countdown timer (auto-updating)
- Last result display
- Color selection (Red/Green/Purple)
- Number selection (0-9)
- Recent winners list
- Bet history preview

### 3. Account Dashboard
- User avatar & profile
- Balance display
- 10 menu options in 2-column grid
- "NEW" badge on Download App
- Logout button (red theme)

### 4. Wallet
- Total balance card
- Add Funds & Withdraw buttons
- Wallet information (type, network, limits)
- Recent transactions preview

### 5. Add Funds
- USDT TRC20 wallet address
- Copy button
- QR code placeholder
- Warning messages
- Deposit instructions

### 6. Withdraw
- Available balance display
- Amount input
- Wallet address input
- Withdrawal password field
- Info note

### 7. Transactions
- Filter tabs (All/Deposit/Withdraw/Bonus)
- Transaction cards with status badges
- Color-coded amounts (+green/-red)
- Date/time stamps

### 8. Bet History
- Detailed bet cards
- Win/Loss badges
- Round ID, selection, result
- Amount with profit/loss

### 9. Security
- Change login password option
- Change withdrawal password option
- Security tips list

### 10. Promotions
- Auto-popup modal on entry
- Bonus statistics (3 cards)
- Promo code with copy button
- Promo link with copy button
- Level tabs (1/2/3)
- Commission history table

### 11. Support
- WhatsApp contact
- Telegram contact
- Email address
- Support hours info

## 🎭 Demo Features

All buttons and forms show visual feedback but don't perform actual operations since this is UI-only:
- Login/Register buttons navigate to home
- Copy buttons show success notifications
- Form submissions show demo message
- All navigation works via JavaScript

## 💡 Notes

- **UI Only**: No backend connections or API calls
- **No Routing**: All screens in one HTML file
- **Static Data**: All displayed data is hardcoded
- **Visual Only**: Interactions provide visual feedback only
- **No Frameworks**: Pure HTML/CSS/JS (no React/Vue/etc.)

## 🌐 Browser Support

- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (iOS Safari, Chrome Mobile)

## 📝 Code Structure

### HTML
- Semantic markup
- All screens in single file
- Section comments for clarity
- Consistent naming conventions

### CSS
- CSS variables for theming
- Mobile-first approach
- Modular component styles
- Reusable utility classes

### JavaScript
- Navigation system
- Tab switching logic
- Modal management
- Copy functions
- Notification system
- Timer functionality
- Event listeners for interactions

## 🎨 Assets

The `assets` folder structure is ready for:
- **icons/**: UI icons (wallet, security, etc.)
- **images/**: Logos, banners, backgrounds

Currently using emoji placeholders for icons.

## 🚀 Deployment

To deploy this UI:

1. **Static Hosting**:
   - Upload to Netlify, Vercel, or GitHub Pages
   - Configure to serve `index.html` as default

2. **Backend Integration**:
   - Replace `onclick` handlers with actual API calls
   - Add form validation and submission logic
   - Connect to authentication system
   - Implement real-time data updates

## 📄 License

This is a UI demonstration project for LuxWin application.

---

**Built with ❤️ using pure HTML, CSS, and JavaScript**
