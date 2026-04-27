[**labelwriter**](../../../README.md)

***

[labelwriter](../../../README.md) / [core/src](../README.md) / MEDIA

# Variable: MEDIA

> `const` **MEDIA**: `object`

Registry of common LabelWriter consumables.

Dimensions come from the Dymo media catalogue (300 DPI print engine,
11.81 dots per mm). Length in dots is kept alongside `heightMm` so
the 550-series status parser can round-trip its dot-based response
to a friendly mm descriptor.

Rectangular die-cut entries declare `defaultOrientation: 'horizontal'`
— users author landscape (long axis horizontal as you read it), and
the driver auto-rotates 90° CW so the visual reads along the tape
feed direction. Pre-retrofit, landscape input was silently cropped
to head width; the auto-rotate path fixes that.

`printMargins` is a design-tool hint (~1.5 mm shipping label inset
per the Dymo spec). `cornerRadiusMm` is informational; previews use
it to render the actual paper outline.

Not exhaustive — this covers the sizes Dymo ships in the US/EU retail
channels. Consumers that need a custom size can construct a
`LabelWriterMedia` on the fly.

## Type Declaration

### ADDRESS\_LARGE

> `readonly` **ADDRESS\_LARGE**: `object`

#### ADDRESS\_LARGE.cornerRadiusMm

> `readonly` **cornerRadiusMm**: `3` = `3`

#### ADDRESS\_LARGE.defaultOrientation

> `readonly` **defaultOrientation**: `"horizontal"` = `'horizontal'`

#### ADDRESS\_LARGE.heightMm

> `readonly` **heightMm**: `89` = `89`

#### ADDRESS\_LARGE.id

> `readonly` **id**: `"address-large"` = `'address-large'`

#### ADDRESS\_LARGE.lengthDots

> `readonly` **lengthDots**: `1050` = `1050`

#### ADDRESS\_LARGE.name

> `readonly` **name**: `"89×36mm Large Address"` = `'89×36mm Large Address'`

#### ADDRESS\_LARGE.printMargins

> `readonly` **printMargins**: `object`

#### ADDRESS\_LARGE.printMargins.bottomMm

> `readonly` **bottomMm**: `1.5` = `1.5`

#### ADDRESS\_LARGE.printMargins.leftMm

> `readonly` **leftMm**: `1.5` = `1.5`

#### ADDRESS\_LARGE.printMargins.rightMm

> `readonly` **rightMm**: `1.5` = `1.5`

#### ADDRESS\_LARGE.printMargins.topMm

> `readonly` **topMm**: `1.5` = `1.5`

#### ADDRESS\_LARGE.type

> `readonly` **type**: `"die-cut"` = `'die-cut'`

#### ADDRESS\_LARGE.widthMm

> `readonly` **widthMm**: `36` = `36`

### ADDRESS\_STANDARD

> `readonly` **ADDRESS\_STANDARD**: `object`

#### ADDRESS\_STANDARD.cornerRadiusMm

> `readonly` **cornerRadiusMm**: `3` = `3`

#### ADDRESS\_STANDARD.defaultOrientation

> `readonly` **defaultOrientation**: `"horizontal"` = `'horizontal'`

#### ADDRESS\_STANDARD.heightMm

> `readonly` **heightMm**: `89` = `89`

#### ADDRESS\_STANDARD.id

> `readonly` **id**: `"address-standard"` = `'address-standard'`

#### ADDRESS\_STANDARD.lengthDots

> `readonly` **lengthDots**: `1050` = `1050`

#### ADDRESS\_STANDARD.name

> `readonly` **name**: `"89×28mm Address"` = `'89×28mm Address'`

#### ADDRESS\_STANDARD.printMargins

> `readonly` **printMargins**: `object`

#### ADDRESS\_STANDARD.printMargins.bottomMm

> `readonly` **bottomMm**: `1.5` = `1.5`

#### ADDRESS\_STANDARD.printMargins.leftMm

> `readonly` **leftMm**: `1.5` = `1.5`

#### ADDRESS\_STANDARD.printMargins.rightMm

> `readonly` **rightMm**: `1.5` = `1.5`

#### ADDRESS\_STANDARD.printMargins.topMm

> `readonly` **topMm**: `1.5` = `1.5`

#### ADDRESS\_STANDARD.type

> `readonly` **type**: `"die-cut"` = `'die-cut'`

#### ADDRESS\_STANDARD.widthMm

> `readonly` **widthMm**: `28` = `28`

### CONTINUOUS\_56MM

> `readonly` **CONTINUOUS\_56MM**: `object`

#### CONTINUOUS\_56MM.id

> `readonly` **id**: `"continuous-56"` = `'continuous-56'`

#### CONTINUOUS\_56MM.name

> `readonly` **name**: `"56mm Continuous"` = `'56mm Continuous'`

#### CONTINUOUS\_56MM.type

> `readonly` **type**: `"continuous"` = `'continuous'`

#### CONTINUOUS\_56MM.widthMm

> `readonly` **widthMm**: `56` = `56`

### FILE\_FOLDER

> `readonly` **FILE\_FOLDER**: `object`

#### FILE\_FOLDER.cornerRadiusMm

> `readonly` **cornerRadiusMm**: `3` = `3`

#### FILE\_FOLDER.defaultOrientation

> `readonly` **defaultOrientation**: `"horizontal"` = `'horizontal'`

#### FILE\_FOLDER.heightMm

> `readonly` **heightMm**: `87` = `87`

#### FILE\_FOLDER.id

> `readonly` **id**: `"file-folder"` = `'file-folder'`

#### FILE\_FOLDER.lengthDots

> `readonly` **lengthDots**: `1027` = `1027`

#### FILE\_FOLDER.name

> `readonly` **name**: `"19×87mm File Folder"` = `'19×87mm File Folder'`

#### FILE\_FOLDER.printMargins

> `readonly` **printMargins**: `object`

#### FILE\_FOLDER.printMargins.bottomMm

> `readonly` **bottomMm**: `1.5` = `1.5`

#### FILE\_FOLDER.printMargins.leftMm

> `readonly` **leftMm**: `1.5` = `1.5`

#### FILE\_FOLDER.printMargins.rightMm

> `readonly` **rightMm**: `1.5` = `1.5`

#### FILE\_FOLDER.printMargins.topMm

> `readonly` **topMm**: `1.5` = `1.5`

#### FILE\_FOLDER.type

> `readonly` **type**: `"die-cut"` = `'die-cut'`

#### FILE\_FOLDER.widthMm

> `readonly` **widthMm**: `19` = `19`

### SHIPPING\_LARGE

> `readonly` **SHIPPING\_LARGE**: `object`

#### SHIPPING\_LARGE.cornerRadiusMm

> `readonly` **cornerRadiusMm**: `3` = `3`

#### SHIPPING\_LARGE.defaultOrientation

> `readonly` **defaultOrientation**: `"horizontal"` = `'horizontal'`

#### SHIPPING\_LARGE.heightMm

> `readonly` **heightMm**: `159` = `159`

#### SHIPPING\_LARGE.id

> `readonly` **id**: `"shipping-large"` = `'shipping-large'`

#### SHIPPING\_LARGE.lengthDots

> `readonly` **lengthDots**: `1878` = `1878`

#### SHIPPING\_LARGE.name

> `readonly` **name**: `"102×159mm Large Shipping"` = `'102×159mm Large Shipping'`

#### SHIPPING\_LARGE.printMargins

> `readonly` **printMargins**: `object`

#### SHIPPING\_LARGE.printMargins.bottomMm

> `readonly` **bottomMm**: `1.5` = `1.5`

#### SHIPPING\_LARGE.printMargins.leftMm

> `readonly` **leftMm**: `1.5` = `1.5`

#### SHIPPING\_LARGE.printMargins.rightMm

> `readonly` **rightMm**: `1.5` = `1.5`

#### SHIPPING\_LARGE.printMargins.topMm

> `readonly` **topMm**: `1.5` = `1.5`

#### SHIPPING\_LARGE.type

> `readonly` **type**: `"die-cut"` = `'die-cut'`

#### SHIPPING\_LARGE.widthMm

> `readonly` **widthMm**: `102` = `102`

### SHIPPING\_STANDARD

> `readonly` **SHIPPING\_STANDARD**: `object`

#### SHIPPING\_STANDARD.cornerRadiusMm

> `readonly` **cornerRadiusMm**: `3` = `3`

#### SHIPPING\_STANDARD.defaultOrientation

> `readonly` **defaultOrientation**: `"horizontal"` = `'horizontal'`

#### SHIPPING\_STANDARD.heightMm

> `readonly` **heightMm**: `102` = `102`

#### SHIPPING\_STANDARD.id

> `readonly` **id**: `"shipping-standard"` = `'shipping-standard'`

#### SHIPPING\_STANDARD.lengthDots

> `readonly` **lengthDots**: `1200` = `1200`

#### SHIPPING\_STANDARD.name

> `readonly` **name**: `"102×59mm Shipping"` = `'102×59mm Shipping'`

#### SHIPPING\_STANDARD.printMargins

> `readonly` **printMargins**: `object`

#### SHIPPING\_STANDARD.printMargins.bottomMm

> `readonly` **bottomMm**: `1.5` = `1.5`

#### SHIPPING\_STANDARD.printMargins.leftMm

> `readonly` **leftMm**: `1.5` = `1.5`

#### SHIPPING\_STANDARD.printMargins.rightMm

> `readonly` **rightMm**: `1.5` = `1.5`

#### SHIPPING\_STANDARD.printMargins.topMm

> `readonly` **topMm**: `1.5` = `1.5`

#### SHIPPING\_STANDARD.type

> `readonly` **type**: `"die-cut"` = `'die-cut'`

#### SHIPPING\_STANDARD.widthMm

> `readonly` **widthMm**: `59` = `59`
