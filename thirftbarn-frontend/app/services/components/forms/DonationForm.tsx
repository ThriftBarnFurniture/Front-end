// app/services/components/forms/DonationForm.tsx
"use client";

import { useState } from "react";
import type { Floor, PropertyType, ServiceId, YesNo } from "../../services";
import { FLOOR_OPTIONS, PROPERTY_TYPE_OPTIONS, YES_NO_OPTIONS } from "../../services";
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

export default function DonationForm({ serviceId }: { serviceId: ServiceId }) {
  const [propertyType, setPropertyType] = useState<PropertyType>("house");
  const [floors, setFloors] = useState<Floor[]>([]);
  const [assemblyDisassembly, setAssemblyDisassembly] = useState<YesNo>("no");

  return (
    <>
      <input type="hidden" name="service_kind" value="donation_pickup" />

      <Section
        title="Pickup location"
        description="Where we’ll be picking up the donation items."
      >
        <Row>
          <Field label="Pickup address" required>
            <Input
              name="donation_address"
              placeholder="Street, City, Postal Code"
              required
              autoComplete="street-address"
            />
          </Field>

          <Field label="Type" required>
            <Select
              name="donation_property_type"
              value={propertyType}
              onChange={(e) => setPropertyType(e.target.value as PropertyType)}
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
            <input
              key={f}
              type="hidden"
              name="donation_floors[]"
              value={f}
            />
          ))}
        </Field>
      </Section>

      <Section
        title="Donation details"
        description="Photos and notes help us plan the pickup."
      >
        <Field label="Assembly / disassembly required?">
          <RadioGroup<YesNo>
            name="donation_assembly_disassembly"
            options={YES_NO_OPTIONS}
            value={assemblyDisassembly}
            onChange={setAssemblyDisassembly}
          />
        </Field>

        <Field
          label="Upload item photos (optional)"
          hint="Upload photos of items being donated."
        >
          <Input type="file" name="photos" accept="image/*" multiple />
        </Field>

        <Field
          label="Special instructions"
          hint="Access notes, preferred pickup times, fragile items, etc."
        >
          <Textarea
            name="donation_special_instructions"
            placeholder="Example: items located in garage, driveway parking available..."
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
