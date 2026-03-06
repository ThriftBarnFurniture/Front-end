// app/services/components/forms/JunkForm.tsx
"use client";

import { useState } from "react";
import type {
  Appliance,
  BoxesRange,
  Floor,
  PropertyType,
  ServiceId,
  YesNo,
} from "../../services";
import {
  APPLIANCE_OPTIONS,
  BOXES_RANGE_OPTIONS,
  FLOOR_OPTIONS,
  PROPERTY_TYPE_OPTIONS,
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

export default function JunkForm({ serviceId }: { serviceId: ServiceId }) {
  // Address + property details
  const [pickupType, setPickupType] = useState<PropertyType>("house");
  const [floors, setFloors] = useState<Floor[]>([]);

  // Junk specifics
  const [hasValueItems, setHasValueItems] = useState<YesNo>("no");
  const [assemblyDisassembly, setAssemblyDisassembly] = useState<YesNo>("no");
  const [wasteBagging, setWasteBagging] = useState<YesNo>("no");
  const [oversized, setOversized] = useState<YesNo>("no");

  const [appliances, setAppliances] = useState<Appliance[]>([]);
  const [boxesRange, setBoxesRange] = useState<BoxesRange>("lt_10");

  return (
    <>
      <input type="hidden" name="service_kind" value="junk_removal" />

      <Section
        title="Pickup location"
        description="Where we’re removing junk from."
      >
        <Row>
          <Field label="Pickup address" required>
            <Input
              name="junk_address"
              placeholder="Street, City, Postal Code"
              required
              autoComplete="street-address"
            />
          </Field>

          <Field label="Type" required>
            <Select
              name="junk_property_type"
              value={pickupType}
              onChange={(e) => setPickupType(e.target.value as PropertyType)}
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
            value={floors}
            onChange={setFloors}
            columns={2}
          />
          {floors.map((f) => (
            <input key={f} type="hidden" name="junk_floors[]" value={f} />
          ))}
        </Field>
      </Section>

      <Section
        title="Junk details"
        description="Help us estimate time, labor, and disposal needs."
      >
        <Row>
          <Field label="Any items of remaining value?">
            <RadioGroup<YesNo>
              name="junk_items_value"
              options={YES_NO_OPTIONS}
              value={hasValueItems}
              onChange={setHasValueItems}
            />
          </Field>

          <Field label="Assembly / disassembly required?">
            <RadioGroup<YesNo>
              name="junk_assembly_disassembly"
              options={YES_NO_OPTIONS}
              value={assemblyDisassembly}
              onChange={setAssemblyDisassembly}
            />
          </Field>
        </Row>

        <Row>
          <Field label="Waste bagging required?">
            <RadioGroup<YesNo>
              name="junk_waste_bagging"
              options={YES_NO_OPTIONS}
              value={wasteBagging}
              onChange={setWasteBagging}
            />
          </Field>

          <Field label="Oversized item?">
            <RadioGroup<YesNo>
              name="junk_oversized_item"
              options={YES_NO_OPTIONS}
              value={oversized}
              onChange={setOversized}
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
            <input key={a} type="hidden" name="junk_appliances[]" value={a} />
          ))}
        </Field>

        <Field label="Number of boxes / totes">
          <Select
            name="junk_boxes_range"
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

        <Field
          label="Upload photos (optional)"
          hint="Photos help us quote accurately and prepare the right vehicle."
        >
          <Input type="file" name="photos" accept="image/*" multiple />
          <HelpPill>Tip: include overall area + close-ups of bulky items.</HelpPill>
        </Field>

        <Field label="Additional details" hint="Anything else we should know?">
          <Textarea
            name="junk_additional_details"
            placeholder="Types of materials, access notes, preferred dates/times, hazards, etc."
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
