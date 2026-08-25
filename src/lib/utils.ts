export const roundMoney=(v:number)=>Math.round(v*100)/100;
export const clamp=(v:number,min=0,max=100)=>Math.min(max,Math.max(min,v));
export const metersToFeet=(v=0)=>v*3.28084;
export const celsiusToFahrenheit=(v?:number)=>v==null?undefined:v*1.8+32;
export const kphToKnots=(v=0)=>v*.539957;
export function circularDistance(a:number,b:number){return Math.abs(Math.abs(((a-b+180)%360)-180));}
export function nearestDirectionDistance(value:number,preferred:number[]){return preferred.length?Math.min(...preferred.map(candidate=>circularDistance(value,candidate))):180;}
export function stableHash(input:string){let hash=2166136261;for(let i=0;i<input.length;i++){hash^=input.charCodeAt(i);hash=Math.imul(hash,16777619);}return hash>>>0;}
export function localDateTimeHour(date:Date,timeZone:string){const parts=new Intl.DateTimeFormat("en-US",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",hourCycle:"h23"}).formatToParts(date),value=(type:Intl.DateTimeFormatPartTypes)=>parts.find(part=>part.type===type)?.value??"";return `${value("year")}-${value("month")}-${value("day")}T${value("hour")}:00`;}
export const localCalendarDate=(date:Date,timeZone:string)=>localDateTimeHour(date,timeZone).slice(0,10);
