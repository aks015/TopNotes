import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NoteCardComponent } from './note-card.component';
import { Note } from '@core/models';

const note: Note = {
  id: 5,
  title: 'Organic Chemistry',
  description: '',
  subject: 'Chemistry',
  examType: 'JEE_MAIN',
  price: 199,
  totalPages: 80,
  averageRating: 4.5,
  reviewCount: 12,
  seller: { id: 1, fullName: 'Priya Sharma' },
};

function render(n: Note): HTMLElement {
  TestBed.configureTestingModule({ imports: [NoteCardComponent], providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(NoteCardComponent);
  fixture.componentRef.setInput('note', n);
  fixture.detectChanges();
  return fixture.nativeElement as HTMLElement;
}

describe('NoteCardComponent', () => {
  it('renders title, mapped exam label, price and seller initials', () => {
    const el = render(note);
    expect(el.textContent).toContain('Organic Chemistry');
    expect(el.textContent).toContain('JEE Main'); // JEE_MAIN → "JEE Main"
    expect(el.textContent).toContain('₹199');
    expect(el.querySelector('.tnc-avatar')?.textContent?.trim()).toBe('PS');
  });

  it('links to the note detail route', () => {
    const link = render(note).querySelector('a.tnc') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toContain('/notes/5');
  });
});
