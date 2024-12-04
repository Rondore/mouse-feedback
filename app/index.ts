
const displayList: Array<ArtDisplay> = [];
const ratio = window.devicePixelRatio;
const pollDelay = 300;

class ArtDisplay{
	readonly canvas: HTMLCanvasElement;
	readonly context: CanvasRenderingContext2D;
	private mousePos: Point | undefined;
	private lastTime: number = -1;
	private mouseDown = false;
	private movements: Array<MouseMovement> = []; //ArrayList<MouseMovement>
	private launchTask: number = -1;

	constructor(canvas: HTMLCanvasElement){
		this.canvas = canvas;
		const context = canvas.getContext('2d');
		canvas.style.cursor = 'crosshair';
		if(context instanceof CanvasRenderingContext2D)
			this.context = context;
		else
			throw new Error('Unable to get canvas context');
		context.scale(ratio, ratio);
		canvas.addEventListener('mousemove', (event: MouseEvent) => {
			let point = new Point(event.x * ratio, event.y * ratio);
			this.processEvent(point, event.timeStamp);
			event.preventDefault();
		});
		canvas.addEventListener('touchmove', (event: TouchEvent) => {
			let point = new Point(event.touches[0].clientX * ratio, event.touches[0].clientY * ratio);
			this.processEvent(point, event.timeStamp, true);
			event.preventDefault();
		});
		canvas.addEventListener('mouseleave', () => {
			this.softReset();
		});
		canvas.addEventListener('touchcancel', (event: TouchEvent) => {
			this.softReset();
		});
		canvas.addEventListener('mousedown', () => {
			this.mouseDown = true;
		});
		canvas.addEventListener('mouseup', () => {
			this.mouseDown = false;
		});
		canvas.addEventListener('touchend', (event: TouchEvent) => {
			this.startShape();
		});
		displayList.push(this);
		this.hardReset();
	}

	width(): number {
		return this.canvas.width;
	}

	height(): number {
		return this.canvas.height;
	}

	softReset(){
		if(this.launchTask != -1){
			clearTimeout(this.launchTask);
		}
		this.lastTime = -1;
		this.mousePos = undefined;
		this.mouseDown = false;
		this.movements = [];
	}

	hardReset(){
		this.softReset();
		this.canvas.width = this.canvas.offsetWidth * ratio;
		this.canvas.height = this.canvas.offsetHeight * ratio;
		this.context.fillStyle = 'black';
		this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
	}
	
	processEvent(point: Point, time: number, isTouch: boolean = false): void {
		if(this.lastTime != -1 && this.mousePos){
			const duration = time - this.lastTime;
			if(duration > 0){
				const movement: MouseMovement = new MouseMovement(point.x - this.mousePos.x, point.y - this.mousePos.y, duration);
				this.movements.push(movement);
			}
			if(this.mouseDown && this.mousePos){
				this.drawLine(this.mousePos, point);
			}
		}
		this.mousePos = point;
		this.lastTime = time;
		if(!isTouch){
			//reset timer
			if(this.launchTask != -1){
				clearTimeout(this.launchTask);
			}
			this.launchTask = setTimeout(() => { this.startShape() }, pollDelay);
		}
	}

	drawLine(point1: Point, point2: Point){
		this.context.strokeStyle = "rgb(128 128 128)";
		this.context.fillStyle = 'transparent';
		this.context.beginPath();
		this.context.moveTo(point1.x, point1.y);
		this.context.lineTo(point2.x, point2.y);
		this.context.stroke();
	}

	startShape(): void {
		if(this.launchTask != -1)
			clearTimeout(this.launchTask);
		if(this.mousePos){
			try {
				const shape = new Shape(this.movements);
				shape.drawCurve(this.mousePos.x, this.mousePos.y, this.context);
			} catch (e) {
				if(e instanceof tooLittleDataException)
					console.error("Too little data to process: " + e.message);
			}
		}
		this.softReset();
	}
}

class HSLColor {
	readonly hue: number;
	readonly saturation: number;
	readonly lightness: number;

	constructor(hue: number, saturation: number, lightness: number){
		this.hue = hue;
		this.saturation = saturation;
		this.lightness = lightness;
	}

	getCSSValue(): string {
		return 'hsl(' + this.hue + ' ' + this.saturation + ' ' + this.lightness + ')';
	}
}

class Curve {
	public rates: Array<number> = []; //ArrayList<double>
	public thickness: Array<number> = []; //ArrayList<double>
	public color: Array<HSLColor> = []; //ArrayList<Color>

	public addPoint(rate: number, thickness: number, color: HSLColor): void {
		this.rates.push(rate);
		this.thickness.push(thickness);
		this.color.push(color);
	}

	public draw(context: CanvasRenderingContext2D, x: number, y: number, scale: number): boolean {
		let firstX = 0, firstY = 0;
		let lastX = 0, lastY = 0;
		for(let i = 0; i < this.rates.length; i++){
			let angle = 2.0 * Math.PI * ((i)/ this.rates.length);
			let magnitude = Math.abs(this.rates[i]) * scale;
			// polar to Cartesian
			let newX = x + Math.round(Math.cos(angle) * magnitude);
			let newY = y + Math.round(Math.sin(angle) * magnitude);
			if(i == 0){
				context.fillStyle = 'transparent';
				context.moveTo(newX, newY);
				firstX = newX;
				firstY = newY;
			}else{
				context.strokeStyle = this.color[i].getCSSValue();
				context.beginPath();
				context.moveTo(lastX, lastY);
				context.lineTo(newX, newY);
				context.stroke();
			}
			lastX = newX;
			lastY = newY;
		}
		context.beginPath();
		context.moveTo(lastX, lastY);
		context.lineTo(firstX, firstY);
		context.stroke();
		return false;
	}
}
	
class tooLittleDataException extends Error {
	constructor(message: string){
		super(message);
	}
}

function smooth(values: Array<number>): Array<number> { //double[]
	for(let i = 0; i < values.length; i++){
		const prev: number = (i == 0)?values[values.length - 1]:values[i - 1];
		const next: number = (i == values.length - 1)?values[0]:values[i + 1];
		values[i] = values[i] * 0.5 + prev * 0.25 + next * 0.25;
	}
	return values;
}

function normalize(values: Array<number>): Array<number>{ //double[]
	let min: number = Number.MAX_VALUE; //double
	let max: number = Number.MIN_VALUE; //double
	for(let i = 0; i < values.length; i++){
		if(values[i] > max) max = values[i];
		if(values[i] < min) min = values[i];
	}
	const range: number = max - min; //double
	for(let i = 0; i < values.length; i++){
		values[i] += min;
		values[i] /= range;
		values[i] *= 100;
	}
	return values;
}

const CORNER_THRESHOLD = 6;
class Shape {
	private readonly movements: Array<MouseMovement>;
	private readonly deltaMovements: Array<DeltaMouseMovement>;
	private readonly jaged: Array<boolean>;
	private groupsOfJag: number; //int
	private readonly curve: Curve;

	constructor(movements: Array<MouseMovement>) { // throws tooLittleDataException
		if(movements.length < 3) throw new tooLittleDataException("Only " + movements.length + " nodes");
		this.deltaMovements = [];
		let lastMove: MouseMovement | null = null;
		let totalDistance: number = 0; //double
		let totalTime: number = 0; //long
		movements.forEach(movement => {
			if(lastMove != null){
				let deltaX = movement.getX() - lastMove.getX();
				let deltaY = movement.getY() - lastMove.getY();
				let deltaSpeed = movement.getSpeed() - lastMove.getSpeed();
				let deltaAngle = movement.getAngle() - lastMove.getAngle();
				this.deltaMovements.push(new DeltaMouseMovement(deltaX, deltaY, deltaSpeed, deltaAngle));
				totalDistance += movement.getDistance();
				totalTime += movement.getDuration();
			}
			lastMove = movement;
		});
		// Find Average Speed of cursor
		let averageSpeed = totalDistance / totalTime;

		// Find Number of "Corners"
		let cornerList: Array<DeltaMouseMovement> = this.deltaMovements.concat();
		let maxCornerDeltas = cornerList.length / CORNER_THRESHOLD;
		cornerList.sort((a: DeltaMouseMovement, b: DeltaMouseMovement) => b.getDeltaAngle() - a.getDeltaAngle() );
		cornerList.splice(maxCornerDeltas);

		// Find Jagedness of movement
		const threshold: number = cornerList[cornerList.length - 1].getDeltaAngle(); //double
		this.jaged = new Array(this.deltaMovements.length);
		this.groupsOfJag = 0; //int
		let isJaged: boolean = false;
		for(let x = 0; x < this.jaged.length; x++){
			let move: DeltaMouseMovement = this.deltaMovements[x];
			if(move.getDeltaAngle() >= threshold){
				if(!isJaged){
					isJaged = true;
					this.groupsOfJag++;
				}
			}else{
				isJaged = false;
			}
			this.jaged[x] = isJaged;
		}

		// Generate shape based on analysis
		const curve:Curve  = new Curve();
		let speedList: Array<number> = new Array(movements.length); //Array<Double>
		let angleList: Array<number> = new Array(movements.length); //Array<Double>
		
		for(let i = 0; i < movements.length; i++){
			let move: MouseMovement = movements[i];
			speedList[i] = move.getSpeed();
			angleList[i] = move.getAngle();
		}
		
		speedList = normalize(speedList);
		//angle = normalize(angle);
		
		speedList = smooth(speedList);
		//angle = smooth(angle);
		
		speedList = normalize(speedList);
		//angle = normalize(angle);
		
		for(let i = 0; i < this.groupsOfJag; i++){
			speedList = smooth(speedList);
			//angle = smooth(angle);
		}
		
		for(let i = 0; i < speedList.length; i++){
			const hue = Math.round(angleList[i] * 180 / Math.PI); //int
			const saturation = Math.round(Math.random() * 50 + 50); //float
			const lightness = Math.round(speedList[i]); //int
			curve.addPoint(speedList[i], 1, new HSLColor(hue, saturation, lightness));
		}
		
		this.movements = movements;
		this.curve = curve;
		console.log("Processed shape with " + movements.length + " nodes and " + this.groupsOfJag + " corners");
	}
	
	public drawCurve(x: number, y: number, canvasContext: CanvasRenderingContext2D): void {
		console.log("Drawing at " + x + ", " + y + "...");
		let scheduledInterval: number = -1;
		let finalMove: MouseMovement = this.movements[this.movements.length - 1];
		const moveX: number = finalMove.getX(); //int
		const moveY: number = finalMove.getY(); //int
		let scale: number = 0.3; //double
		let i: number = 0; //int
		const timerTask = ()=>{
			this.curve.draw(canvasContext, x + moveX * i, y + moveY * i, scale);
			scale = scale * 1.05;
			if(scale > 400){
				clearInterval(scheduledInterval);
			}
			i++;
		};
		scheduledInterval = setInterval(timerTask, 10);
	}
}

class DeltaMouseMovement {
	private readonly deltaX: number; //int
	private readonly deltaY: number; //int
	private readonly deltaSpeed: number; //double
	private readonly deltaAngle: number; //double

	constructor(deltaX: number, deltaY: number, deltaSpeed: number, deltaAngle: number){
		this.deltaX = deltaX;
		this.deltaY = deltaY;
		this.deltaSpeed = deltaSpeed;
		this.deltaAngle = deltaAngle;
	}

	public getDeltaX(): number { //int
		return this.deltaX;
	}

	public getDeltaY(): number { //int
		return this.deltaY;
	}

	public getDeltaSpeed(): number { //double
		return this.deltaSpeed;
	}

	public getDeltaAngle(): number { //double
		return this.deltaAngle;
	}
}

class MouseMovement {
	
	private readonly x: number; //int
	private readonly y: number; //int
	private readonly duration: number; //long
	private readonly angle: number; //double
	private readonly distance: number; //double
	private readonly pxPerSecond: number; //double
	
	constructor(x: number, y: number, duration: number){
		this.x = x;
		this.y = y;
		
		const angleInRadians = Math.acos(x / Math.hypot(x, y)); //double
		this.duration = duration;
		this.angle = angleInRadians;
		this.distance = Math.hypot(x, y);
		this.pxPerSecond = this.distance / duration;
	}
	
	public getX(): number { //int
		return this.x;
	}
	
	public getY(): number { //int
		return this.y;
	}
	
	public getDuration(): number { //long
		return this.duration;
	}
	
	public getAngle(): number { //double
		return this.angle;
	}
	
	public getDistance(): number { //double
		return this.distance;
	}
	
	public getSpeed(): number { //double
		return this.pxPerSecond;
	}
}

class Point {
	readonly x: number;
	readonly y: number;

	constructor(x: number, y: number){
		this.x = x;
		this.y = y;
	}
}

export function registerCanvas(canvas: HTMLCanvasElement): void {
	new ArtDisplay(canvas);
}

function registerClassCompliant(){
	let canvi = document.getElementsByClassName('mouse-feedback-canvas');
	for(let i = 0; i < canvi.length; i++){
	let canvas = canvi[i];
	if(canvas instanceof HTMLCanvasElement)
		registerCanvas(canvas);
	}
}
registerClassCompliant();