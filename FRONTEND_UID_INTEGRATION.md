# Frontend Integration Guide for UID System

## HTML Changes Required

### 1. Account Screen (`index.html` around line 608-612)

Add UID display after the email element:

```html
\u003cdiv class=\"profile-details\"\u003e
    \u003cp class=\"email\" id=\"userEmail\"\u003e
        user*****@mail.com
    \u003c/p\u003e
    \u003c!-- ADD THIS LINE --\u003e
    \u003cp class=\"user-uid\" id=\"userUid\"\u003eUID: 0\u003c/p\u003e
    \u003c!-- Country selector code continues... --\u003e
```

### 2. Move Country Selector to Top-Right

Add class to country-selector-wrapper (line 612):

```html
\u003c!-- Change from: --\u003e
\u003cdiv class=\"country-selector-wrapper\"\u003e

\u003c!-- To: --\u003e
\u003cdiv class=\"country-selector-wrapper country-selector-topright\"\u003e
```

### 3. Admin Panel (`admin.html` line 263)

Update table header:

```html
\u003c!-- Change from: --\u003e
\u003cth\u003eUser ID\u003c/th\u003e

\u003c!-- To: --\u003e
\u003cth\u003eUID\u003c/th\u003e
```

Update search placeholder (line 247):

```html
\u003cinput
    type=\"text\"
    placeholder=\"Search users by email or UID...\"
    class=\"search-input\"
    id=\"userSearchInput\"
/\u003e
```

## CSS Changes Required

Add to `style.css`:

```css
/* Import UID styles */
@import url('uid-styles.css');
```

OR copy the contents of `uid-styles.css` directly into `style.css`.

## JavaScript Changes Required

### In `app.js`:

1. **After successful login** (search for login success handler):

```javascript
// Store UID in global state
if (userData.uid) {
    window.currentUser.uid = userData.uid;
    
    // Update UID display
    const uidElement = document.getElementById('userUid');
    if (uidElement) {
        uidElement.textContent = `UID: ${userData.uid}`;
    }
}
```

2. **After successful registration** (search for registration success handler):

```javascript
// Same as login - store and display UID
if (userData.uid) {
    window.currentUser.uid = userData.uid;
    const uidElement = document.getElementById('userUid');
    if (uidElement) {
        uidElement.textContent = `UID: ${userData.uid}`;
    }
}
```

### In `admin.js`:

1. **Update `loadUsers()` function** to display UID instead of UUID:

```javascript
// In the table row generation, change from:
\u003ctd\u003e${user.id}\u003c/td\u003e

// To:
\u003ctd class=\"uid-column\"\u003eUID: ${user.uid}\u003c/td\u003e

// But keep UUID in data attributes:
\u003ctr data-user-id=\"${user.id}\" data-uid=\"${user.uid}\"\u003e
```

2. **Search function already works** - backend handles numeric search as UID search.

## Quick Integration Steps

1. Add UID display element to `index.html` (1 line)
2. Add class to country selector wrapper (1 word change)
3. Import or add CSS from `uid-styles.css`
4. Update `app.js` login/register handlers (4-6 lines each)
5. Update `admin.html` table header (1 word change)
6. Update `admin.js` loadUsers() function (2 lines)

Total changes: ~15-20 lines across 5 files.
