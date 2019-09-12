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
	align?: 'left' | 'right' | 'justify';
}

export default class LayoutGenerator {
	private font: BMFont;
	private chars: CharCache = {};
	private kernings: kerning[] = [];
	private baselineOffset: number;
	private wrapper: WordWrapper;

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
	}

	public layout( props: LayoutProps ) {
		const {
			text,
			width,
			noWrap,
			letterSpacing = 0,
			lineHeight = this.font.common.lineHeight / this.font.info.size,
			tabWidth = 1,
			align = 'left',
		} = props;

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
		let pointer = 0;

		lines.forEach( ( text, lineNo ) => {
			const lineWidth = this.wrapper.mesure( text );
			const spaces = text.match( /\u0020|\u00A0/gm );
			const spaceFill = ( width - lineWidth ) / ( spaces ? spaces.length : 1 );
			let previousChar: Char;
			let xPos = align === 'right' ? width - lineWidth : 0;

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

					const x1 = xPos + char.xOffset;
					const x2 = xPos + char.xOffset + char.width;
					const y1 = -( lineNo * lineHeight ) - char.yOffset + this.baselineOffset;
					const y2 = -( lineNo * lineHeight ) - char.yOffset - char.height + this.baselineOffset;


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
					xPos += char.xAdvance;
					previousChar = char;
				}
			});
		});

		return {
			verts,
			uvs,
			indices,
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
}
