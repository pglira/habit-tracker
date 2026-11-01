# Habits

A Progressive Web App that tracks daily habits.

- Add, edit and remove habits, each with a color and a start day. Swipe a habit to the left to show Edit and Delete.
- Change the order of the habits: tap the order button in the day view and drag the handle of a habit up or down.
- Day view: tap a habit to mark it as done on the selected day. Go back to earlier days with the arrows.
- Month view: a calendar for each habit. Tap a day to mark the habit as done or not done.
- Goal: every day, or a number of days per week or per month. The day view shows the done days of the current week or month, for example "Week 2/3".
- Score: the percentage of the goal that a habit reaches. Only days from the start day on count. The day view shows the score since the start of the habit, the month view shows the score of the month. A day or a period that is not over yet counts only with its done days.
- Back up all data: the backup button in the header opens Export and Import. Export saves all data to a file. Import the file on a new phone to replace all data.

## Tech

- React, TypeScript and Vite
- `vite-plugin-pwa` for the manifest, the service worker and the offline cache
- `localStorage` for the data

## Development

```bash
npm install
npm run dev
```

## Deployment

The GitHub Actions workflow `.github/workflows/deploy.yml` builds the app and publishes it to GitHub Pages on each push to `main`. The app is served at `https://pglira.github.io/habit-tracker/`.

## Install on iOS

Open the URL in Safari, tap Share and select "Add to Home Screen".
