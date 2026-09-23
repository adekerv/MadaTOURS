import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripsSchema, tripSchema, moveStop, tripSummary, legDirections } from '../src/lib/trips';
import { normalizePlace } from '../src/lib/places-utils';
import { translate } from '../src/i18n/core';
import { french } from '../src/i18n/fr';
import places from '../src/data/places.json';
const trip={id:'00000000-0000-4000-8000-000000000001',name:'Saturday',date:'2026-09-26',notes:'Water and picnic',stops:[{placeId:2,minutes:60},{placeId:3,minutes:90}],updatedAt:'2026-09-23T10:00:00.000Z'};
test('day trips preserve ordering, validate dates, and reject malformed or oversized saved data',()=>{
 assert.deepEqual(moveStop(trip,0,1).stops.map(s=>s.placeId),[3,2]);assert.equal(moveStop(trip,0,-1),trip);
 assert.equal(tripSchema.safeParse({...trip,date:'2026-02-31'}).success,false);
 assert.equal(tripSchema.safeParse({...trip,date:'9999-99-99'}).success,false);
 assert.equal(tripSchema.safeParse({...trip,stops:[trip.stops[0],trip.stops[0]]}).success,false);
 assert.equal(tripsSchema.safeParse({version:1,trips:Array(21).fill(trip)}).success,false);
 assert.equal(tripSummary(trip,places.map(normalizePlace)).minutes,150);
 assert.ok(tripSummary(trip,places.map(normalizePlace)).distance>0);
 const url=new URL(legDirections(normalizePlace(places[1]),normalizePlace(places[2])));assert.equal(url.searchParams.get('origin'),'14.671181,-61.092064');
});
test('French translations preserve all interpolation placeholders',()=>{
 for(const [en,fr] of Object.entries(french))assert.deepEqual([...en.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),[...fr.matchAll(/\{(\w+)\}/g)].map(m=>m[1]).sort(),en);
 assert.equal(translate('fr','Close {title}',{title:'Balata'}),'Fermer Balata');
 assert.equal(translate('en','Close {title}',{title:'Balata'}),'Close Balata');
});
