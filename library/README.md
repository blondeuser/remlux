# Fixture library

One folder per brand, one sub folder per lighting type, one `.ies` or `.ldt` (EULUMDAT) file per fixture:

```
library/
  erco/downlights/quintessence-3000lm-36deg.ldt
  erco/track-lights/optec-spot.ldt
  iGuzzini/linear/laser-blade.ies
  Lucelight/downlights/…
```

- Type folders can be named anything (`downlights`, `track-lights`, `linear`, `wall-washers`…). They show as filter chips in the picker. A file placed directly in a brand folder is listed under "Other".
- The picker is a Finder-style column view: brand, then the sub folder (type or product family), then the fixtures. Deeper folders are flattened into the sub folder.
- The folder name is the brand shown in the picker (all-lowercase names get a capital; use `iGuzzini` to keep your own casing).
- Restart `npm run dev` after adding files. They are bundled at build time.
- Get the files from each manufacturer's product page (usually "Downloads", "Photometric data"). Check their terms before committing them to a public repository.
- Only Type C photometry is supported (downlights, spots, most luminaires).
