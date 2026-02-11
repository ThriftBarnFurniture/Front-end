// app/services/components/forms/MovingForm.tsx
"use client";

import { useMemo, useState } from "react";
import type { ServiceId, Appliance, Floor, PropertyType, Room, YesNo, BoxesRange } from "../../services";
import {
  APPLIANCE_OPTIONS,
  BOXES_RANGE_OPTIONS,
  FLOOR_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
  ROOM_OPTIONS,
  YES_NO_OPTIONS,
} from "../../services";
import {
  CheckboxGroup,
  Field,
  Input,
  RadioGroup,
  Row,
  Section,
  Select,
  Textarea,
  HelpPill,
} from "../shared";

export default function MovingForm({ serviceId }: { serviceId: ServiceId }) {
  // Addresses + property details
  const [loadType, setLoadType] = useState<PropertyType>("house");
  const [unloadType, setUnloadType] = useState<PropertyType>("house");
  const [loadFloors, setLoadFloors] = useState<Floor[]>([]);
  const [unloadFloors, setUnloadFloors] = useState<Floor[]>([]);

  // Rooms + bedroom count
  const [rooms, setRooms] = useState<Room[]>([]);
  const [bedroomCount, setBedroomCount] = useState<string>("1");
  const hasBedroom = useMemo(() => rooms.includes("bedroom"), [rooms]);

  // Move requirements
  const [kingBed, setKingBed] = useState<YesNo>("no");
  const [mattressBags, setMattressBags] = useState<YesNo>("no");
  const [packing, setPacking] = useState<YesNo>("no");
  const [disassembly, setDisassembly] = useState<YesNo>("no");
  const [assembly, setAssembly] = useState<YesNo>("no");
  const [oversized, setOversized] = useState<YesNo>("no");

  // Appliances + boxes
  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [boxesRange, setBoxesRange] = useState<BoxesRange>("lt_10");

  return (
    <>
      {/* Hidden hint so backend can route/format properly */}
      <input type="hidden" name="service_kind" value="moving" />

      <Section
        title="Load location"
        description="Where we’re picking up from."
      >
        <Row>
          <Field label="Load address" required>
            <Input
              name="moving_load_address"
              placeholder="Street, City, Postal Code"
              required
              autoComplete="street-address"
            />
          </Field>

          <Field label="Type" required>
            <Select
              name="moving_load_type"
              value={loadType}
              onChange={(e) => setLoadType(e.target.value as PropertyType)}
              required
            >
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </Row>

        <Field label="Floors (select all that apply)">
          <CheckboxGroup
            options={FLOOR_OPTIONS}
            value={loadFloors}
            onChange={setLoadFloors}
            columns={2}
          />
          {/* Submit as repeated fields */}
          {loadFloors.map((f) => (
            <input key={f} type="hidden" name="moving_load_floors[]" value={f} />
          ))}
        </Field>
      </Section>

      <Section
        title="Unload location"
        description="Where we’re delivering to."
      >
        <Row>
          <Field label="Unload address" required>
            <Input
              name="moving_unload_address"
              placeholder="Street, City, Postal Code"
              required
              autoComplete="street-address"
            />
          </Field>

          <Field label="Type" required>
            <Select
              name="moving_unload_type"
              value={unloadType}
              onChange={(e) => setUnloadType(e.target.value as PropertyType)}
              required
            >
              {PROPERTY_TYPE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </Row>

        <Field label="Floors (select all that apply)">
          <CheckboxGroup
            options={FLOOR_OPTIONS}
            value={unloadFloors}
            onChange={setUnloadFloors}
            columns={2}
          />
          {unloadFloors.map((f) => (
            <input
              key={f}
              type="hidden"
              name="moving_unload_floors[]"
              value={f}
            />
          ))}
        </Field>
      </Section>

      <Section
        title="Move scope"
        description="Select what’s being moved and any special requirements."
      >
        <Field label="Rooms being moved (select all that apply)">
          <CheckboxGroup
            options={ROOM_OPTIONS}
            value={rooms}
            onChange={(next) => {
              setRooms(next);
              // If bedroom gets deselected, keep it tidy
              if (!next.includes("bedroom")) setBedroomCount("1");
            }}
            columns={2}
          />
          {rooms.map((r) => (
            <input key={r} type="hidden" name="moving_rooms[]" value={r} />
          ))}
        </Field>

        {hasBedroom ? (
          <Row>
            <Field label="How many bedrooms?">
              <Select
                name="moving_bedroom_count"
                value={bedroomCount}
                onChange={(e) => setBedroomCount(e.target.value)}
              >
                {Array.from({ length: 8 }).map((_, i) => {
                  const v = String(i + 1);
                  return (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  );
                })}
                <option value="9+">9+</option>
              </Select>
            </Field>

            <Field label="King bed?">
              <RadioGroup<YesNo>
                name="moving_king_bed"
                options={YES_NO_OPTIONS}
                value={kingBed}
                onChange={setKingBed}
              />
            </Field>
          </Row>
        ) : null}

        <Row>
          <Field label="Mattress bags required?">
            <RadioGroup<YesNo>
              name="moving_mattress_bags"
              options={YES_NO_OPTIONS}
              value={mattressBags}
              onChange={setMattressBags}
            />
          </Field>

          <Field label="Packing required?">
            <RadioGroup<YesNo>
              name="moving_packing_required"
              options={YES_NO_OPTIONS}
              value={packing}
              onChange={setPacking}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Disassembly required?">
            <RadioGroup<YesNo>
              name="moving_disassembly_required"
              options={YES_NO_OPTIONS}
              value={disassembly}
              onChange={setDisassembly}
            />
          </Field>

          <Field label="Assembly required?">
            <RadioGroup<YesNo>
              name="moving_assembly_required"
              options={YES_NO_OPTIONS}
              value={assembly}
              onChange={setAssembly}
            />
          </Field>
        </Row>

        <Field label="Appliances (select all that apply)">
          <CheckboxGroup
            options={APPLIANCE_OPTIONS}
            value={appliances}
            onChange={setAppliances}
            columns={2}
          />
          {appliances.map((a) => (
            <input
              key={a}
              type="hidden"
              name="moving_appliances[]"
              value={a}
            />
          ))}
        </Field>

        <Row>
          <Field label="Number of boxes / totes">
            <Select
              name="moving_boxes_range"
              value={boxesRange}
              onChange={(e) => setBoxesRange(e.target.value as BoxesRange)}
            >
              {BOXES_RANGE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Oversized item?">
            <RadioGroup<YesNo>
              name="moving_oversized_item"
              options={YES_NO_OPTIONS}
              value={oversized}
              onChange={setOversized}
            />
          </Field>
        </Row>

        <Field
          label="Upload photos (optional)"
          hint="Helps us understand the scope of the move."
        >
          <Input
            type="file"
            name="photos"
            accept="image/*"
            multiple
          />
          <HelpPill>Tip: upload wide shots + close-ups of large items.</HelpPill>
        </Field>

        <Field label="Additional details" hint="Anything else we should know?">
          <Textarea
            name="moving_additional_details"
            placeholder="Parking notes, elevators, tight hallways, special items, preferred dates/times, etc."
          />
        </Field>
      </Section>

      <Section
        title="Contact info"
        description="We’ll use this to reach out and to send your confirmation email."
      >
        <Row>
          <Field label="Full name" required>
            <Input name="contact_name" placeholder="Your name" required />
          </Field>

          <Field label="Phone number" required>
            <Input
              name="contact_phone"
              placeholder="(###) ###-####"
              required
              autoComplete="tel"
            />
          </Field>
        </Row>

        <Field label="Email" required>
          <Input
            name="contact_email"
            type="email"
            placeholder="you@email.com"
            required
            autoComplete="email"
          />
        </Field>
      </Section>
    </>
  );
}
