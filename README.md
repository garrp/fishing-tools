# FishyNW Planning Tools

FishyNW Planning Tools is a lightweight fishing planning app built for quick trip checks on mobile or desktop. It helps anglers review date, location, weather, wind, rain chance, fishing-window timing, moon phase, weather alerts, trolling depth, species tips, and GPS speed.

## Current Version

V1.03

## Main Features

### Planning Tools

The main planning page lets the user:

1. Pick a trip date
2. Pick a location
3. View fishing conditions for that date

The app then shows:

- Temperature
- Rain chance
- Max sustained wind
- Max wind gust
- Fishing status: GO, CAUTION, or NO-GO
- Combined hourly chart for fishing timing, wind, and rain chance
- Wind speed and direction note
- Lunar phase card below the chart
- Weather alerts only when active for the selected date

## Smart Location Search

The location picker supports natural input, including city/state shorthand and common FishyNW fishing locations.

Examples:

- Cocolalla ID
- Cocolalla Idaho
- Cocolalla, ID
- Hauser ID
- Fernan
- Wolf Lodge
- Denton Slough
- Newman Lake WA

The app does not auto-fill while the user is typing. The user can type at their own pace and tap **Find** when ready.

The **GPS** button is available but does not auto-run on page load.

## Weather Alerts

Weather alerts are pulled from NOAA/NWS.

The app checks alert timing and only applies weather alerts to the GO/NO-GO status when the alert overlaps the selected date.

Example:

If an alert starts on 1/20 and lasts 72 hours, the app should not mark days after that alert expires as NO-GO just because the alert existed earlier.

If there are no active alerts for the selected date, no weather alert bar is shown.

## Combined Conditions Chart

The main chart combines three planning data points into one clean hourly view:

- Fishing window strength
- Wind
- Rain chance

The chart uses one shared hourly timeline so conditions are easier to compare without switching between separate charts.

## Wind Note

Below the chart, the app shows a short wind summary, including:

- Peak hourly wind speed
- Approximate time of peak wind
- Direction at peak wind
- Average wind direction when available

## Lunar Phase

The lunar phase card appears below the fishing/wind/rain chart.

It updates based on the selected date and includes:

- Moon phase name
- Moon phase graphic
- Illumination percentage
- Approximate moon age in days

The moon graphic is generated inside the app and styled to match the FishyNW look.

## Other Tools

### Trolling Depth Calculator

A simple trolling depth estimator using:

- Speed
- Weight
- Line out
- Line test
- Line type

This is meant as a starting estimate, not a guaranteed depth reading.

### Species Tips

Species tips provide general guidance for fishing different species and conditions.

### Speedometer

The speedometer uses device GPS to show movement speed.

This can help with trolling speed and general kayak movement checks.

## Files

The app uses a simple static file structure:

- `index.html`
- `app.js`
- Optional `styles.css`

Most app styling is injected directly from `app.js`.

## Installation

Place the files in the same folder:

```text
index.html
app.js
styles.css
