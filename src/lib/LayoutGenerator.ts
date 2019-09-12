import { BufferGeometry } from '@downpourdigital/boxes';

import BMFont, { kerning } from '../types/BMFont';
import WordWrapper from './WordWrapper';


type Char = {
	id: number;
	width: number,
	height: number,
	xAdvance: number,
	xOffset: number,
	yOffset: number,
	page: number,
	uvs: [number, number, number, number],
};
type CharCache = { [s: number]: Char };


interface LayoutProps {
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
}

export default class LayoutGenerator {
	private font: BMFont;
	private chars: CharCache = {};
	private kernings: kerning[] = [];
	private baselineOffset: number;
	private wrapper: WordWrapper;
	public capHeight: number = 0;
	public xHeight: number = 0;
	public ascenderHeight: number = 0;
	public descenderHeight: number = 0;

	constructor( font: BMFont ) {
		this.font = font;

		font.chars.forEach( ( char ) => {
			const x1 = char.x / font.common.scaleW;
			const y1 = char.y / font.common.scaleH;
			const x2 = ( char.x + char.width ) / font.common.scaleW;
			const y2 = ( char.y + char.height ) / font.common.scaleH;

			this.chars[char.id] = {
				width: char.width / font.info.size,
				height: char.height / font.info.size,
				xAdvance: char.xadvance / font.info.size,
				xOffset: char.xoffset / font.info.size,
				yOffset: char.yoffset / font.info.size,
				page: char.page,
				id: char.id,
				uvs: [
					x1, y1,
					x2, y2,
				],
			};
		});

		this.kernings = font.kernings.map( k => ({
			first: k.first,
			second: k.second,
			amount: k.amount / font.info.size,
		}) );

		this.wrapper = new WordWrapper({
			font,
			useKernings: true,
		});

		this.baselineOffset = this.font.common.base / this.font.info.size;

		this.computeMetrics();
	}

	public layout( props: LayoutProps ) {
		const {
			text,
			width,
			noWrap,
			letterSpacing = 0,
			lineHeight = this.font.common.lineHeight / this.font.info.size,
			tabWidth = 1,
			xShift = -this.font.info.padding[3] / this.font.info.size,
			align = 'left',
			computeLineY = false,
			computeCharUvs = false,
			computeCharIndex = false,
			computeLineIndex = false,
		} = props;

		const padTop = this.font.info.padding[0] / this.font.info.size;

		const str = noWrap ? text : this.wrapper.wrap({
			text,
			width,
			letterSpacing,
			tabWidth,
		});


		const lines = str.split( '\n' );
		const verts: number[] = [];
		const uvs: number[] = [];
		const indices: number[] = [];
		const lineY: number[] = [];
		const charUvs: number[] = [];
		const charIndices: number[] = [];
		const lineIndices: number[] = [];
		let pointer = 0;
		let charIndex = 0;

		lines.forEach( ( text, lineNo ) => {
			const emptySpace = width - this.wrapper.mesure( text );
			const spaces = text.match( /\u0020|\u00A0/gm );
			const spaceFill = emptySpace / ( spaces ? spaces.length : 1 );
			let previousChar: Char;
			let xPos = 0;

			if ( align === 'right' ) {
				xPos = emptySpace;
			} else if ( align === 'center' ) {
				xPos = emptySpace / 2;
			}

			text.split( '' ).forEach( ( s ) => {
				const code = s.charCodeAt( 0 );
				const char = this.chars[code];

				if ( align === 'justify' && ( code === 32 || code === 160 ) ) {
					xPos += spaceFill;
				}

				if ( code === 9 ) {
					// tab
					xPos += tabWidth;
				} else if ( char ) {
					if ( previousChar ) {
						const kerning = this.kernings.find(
							k => k.first === previousChar.id && k.second === char.id,
						);
						if ( kerning ) xPos += kerning.amount;
						xPos += letterSpacing;
					}

					const y1Relative = char.yOffset
						- this.baselineOffset - padTop;

					const y2Relative = char.yOffset
						+ char.height - this.baselineOffset - padTop;

					if ( computeLineY ) {
						const h1 = this.ascenderHeight + y1Relative;
						const h2 = this.ascenderHeight + y2Relative;

						lineY.push(
							h1,
							h1,
							h2,
							h2,
						);
					}

					if ( computeCharUvs ) {
						charUvs.push(
							0, 1,
							1, 1,
							0, 0,
							1, 0,
						);
					}

					if ( computeCharIndex ) {
						charIndices.push( charIndex, charIndex, charIndex, charIndex );
					}

					if ( computeLineIndex ) {
						lineIndices.push( lineNo, lineNo, lineNo, lineNo );
					}

					const x1 = xPos + char.xOffset + xShift;
					const x2 = xPos + char.xOffset + char.width + xShift;
					const y1 = -( lineNo * lineHeight ) - y1Relative;
					const y2 = -( lineNo * lineHeight ) - y2Relative;


					verts.push(
						// top left
						x1, y1,

						// top right
						x2, y1,

						// bottom left
						x1, y2,

						// bottom right
						x2, y2,
					);

					uvs.push(
						char.uvs[0], char.uvs[1],
						char.uvs[2], char.uvs[1],
						char.uvs[0], char.uvs[3],
						char.uvs[2], char.uvs[3],
					);

					indices.push(
						// first tri, ccw: tl, bl, tr
						pointer,
						pointer + 2,
						pointer + 1,

						// second tri, ccw: tr, bl, br
						pointer + 1,
						pointer + 2,
						pointer + 3,
					);

					pointer += 4;
					charIndex += 1;
					xPos += char.xAdvance;
					previousChar = char;
				}
			});
		});

		return {
			verts,
			uvs,
			indices,
			lineY,
			charUvs,
			charIndices,
			lineIndices,
			charCount: charIndex + 1,
			lineCount: lines.length,
		};
	}


	public getGeometry( props: LayoutProps ) {
		const data = this.layout( props );

		const geometry = new BufferGeometry({
			verts: data.verts,
			indices: data.indices,
			attributes: [
				data.uvs,
			],
			components: 2,
		});

		return geometry;
	}


	private computeMetrics() {
		const caps = 'HXNTKM'.split( '' );
		const lowChars = 'xvwz'.split( '' );

		const padTop = this.font.info.padding[0] / this.font.info.size;
		const padBottom = this.font.info.padding[2] / this.font.info.size;


		const getMaxHeight = ( chars: string[], ascender = true ) => {
			let maxHeight = 0;
			chars.forEach( ( s ) => {
				const code = s.charCodeAt( 0 );
				const char = this.chars[code];

				if ( char ) {
					const totalHeight = char.height + char.yOffset;
					const desc = totalHeight - this.baselineOffset;
					const asc = char.height - desc;

					maxHeight = Math.max(
						maxHeight,
						ascender ? asc : desc - padBottom - padTop,
					);
				}
			});

			return maxHeight;
		};


		this.capHeight = getMaxHeight( caps );
		this.xHeight = getMaxHeight( lowChars );
		this.ascenderHeight = getMaxHeight( this.font.info.charset );
		this.descenderHeight = getMaxHeight( this.font.info.charset, false );
	}
}
