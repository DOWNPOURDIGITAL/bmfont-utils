# BMFont utils
BMFont utilities for WebGL.

```
yarn add @downpourdigital/bmfont-utils
```
```
npm i @downpourdigital/bmfont-utils
```

## LayoutGenerator
```typescript
import {
	LayoutGenerator,
} from '@downpourdigital/bmfont-utils';

const generator = new LayoutGenerator( font: BMFont );
```
---
The generator instance exposes some metrics about the font:

```typescript
generator.capHeight
generator.xHeight
generator.ascenderHeight
generator.descenderHeight

```
If you're not familiar with the terminology, [Monotype has you covered.](https://www.fontshop.com/glossary) All metrics are relative to font-size 1.

---

`LayoutGenerator` only has one method:

```typescript
generator.layout({
	text: string;
	width?: number;
	letterSpacing?: number;
	lineHeight?: number;
	noWrap?: boolean;
	tabWidth?: number;
	xShift?: number;
	align?: 'left' | 'right' | 'center' | 'justify';
	computeLineY?: boolean;
	computeCharUvs?: boolean;
	computeCharIndex?: boolean;
	computeLineIndex?: boolean;
});
```
`width` defines the maximum line-width at font-size 1. Most of the other options should be self-explanatory. By setting the `computeXXXX` options to `true`, you can compute some additional vertex attributes:

`LineY` describes the verical position of the vertex between ascender (0) and descender (1).

`CharUvs` gives you normalized coordinates relative to the current glyph quad.

`CharIndex` and `LineIndex` should be self-explanatory.

---

`LayoutGenerator.layout()` returns an object, which may be used to construct an indexed buffer geometry:

```typescript
{
	verts: number[],
	uvs: number[],
	indices: number[],
	lineY?: number[],
	charUvs?: number[],
	charIndices?: number[],
	lineIndices?: number[],
	charCount: number,
	lineCount: number,
}
```
`verts` are the actual **2D** vertices, `indices` are the pointer indices for your `ELEMENT_ARRAY_BUFFER`.

It's important to note that everything here is relative to font-size 1, so some scaling may be necessary on your end.


## WordWrapper
`WordWrapper` is a naïve implementation of a greedy word wrapper. It bases its measurements on the actual glyph widths and takes kernings into account.

```typescript
import {
	WordWrapper,
} from '@downpourdigital/bmfont-utils';

const wrapper = new WordWrapper({
	font: BMFont;
	breakPoints?: BreakPoint[];
	useKernings?: boolean;
});
```
`breakPoints` defines an array of possible line break opportunities. By default, space (`\u0020`), soft hyphen (`\u00AD`), en dash (`\u2013`), em dash (`\u2014`) and hyphen minus (`\u002D`) are used.

A `BreakPoint` consists of a `char` to look for and its replacement, containing the actual line-break:

```typescript
{	// en dash
	char: '–'.charCodeAt( 0 ),
	replace: '–\n',
}
```
---
Two methods are exported:

```typescript
wrapper.mesure( text: string );
```
Returns the width of a given string at font-size 1.

---

```typescript
wrapper.wrap(
	text: string;
	width?: number;
	letterSpacing?: number;
	tabWidth?: number;
});
```
Returns a given string `text` with inserted line-breaks.

`width` defines the maximum line-width at font-size 1, `letterSpacing` and `tabWidth` should be self-explanatory


## License
© 2019 [DOWNPOUR DIGITAL](https://downpour.digital), licensed under BSD-4-Clause