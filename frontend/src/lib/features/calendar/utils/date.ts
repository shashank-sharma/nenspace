export function getMonthDays(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    const firstDay = new Date(year, month, 1);
    
    const lastDay = new Date(year, month + 1, 0);
    
    const firstDayOfWeek = firstDay.getDay();
    
    const daysInMonth = lastDay.getDate();
    
    const days: Date[] = [];
    
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    
    for (let i = firstDayOfWeek - 1; i >= 0; i--) {
        days.push(new Date(year, month - 1, prevMonthLastDay - i));
    }
    
    for (let i = 1; i <= daysInMonth; i++) {
        days.push(new Date(year, month, i));
    }
    
    const remainingDays = 42 - days.length;
    
    for (let i = 1; i <= remainingDays; i++) {
        days.push(new Date(year, month + 1, i));
    }
    
    return days;
}

export function getWeekDays(date: Date): Date[] {
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const dayOfWeek = date.getDay();
    
    const startDate = new Date(year, month, day - dayOfWeek);
    
    const weekDays: Date[] = [];
    
    for (let i = 0; i < 7; i++) {
        weekDays.push(new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i));
    }
    
    return weekDays;
}

export function getDayHours(): string[] {
    const hours: string[] = [];
    
    for (let i = 0; i < 24; i++) {
        hours.push(`${i.toString().padStart(2, '0')}:00`);
    }
    
    return hours;
}

export function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

export function formatDateReadable(date: Date): string {
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

export function formatTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });
}

export function formatDuration(start: Date | string, end: Date | string): string {
    const startDate = typeof start === 'string' ? new Date(start) : start;
    const endDate = typeof end === 'string' ? new Date(end) : end;
    
    const durationMs = endDate.getTime() - startDate.getTime();
    const durationMinutes = Math.floor(durationMs / (1000 * 60));
    
    const hours = Math.floor(durationMinutes / 60);
    const minutes = durationMinutes % 60;
    
    if (hours === 0) {
        return `${minutes} min${minutes !== 1 ? 's' : ''}`;
    } else if (minutes === 0) {
        return `${hours} hr${hours !== 1 ? 's' : ''}`;
    } else {
        return `${hours} hr${hours !== 1 ? 's' : ''} ${minutes} min${minutes !== 1 ? 's' : ''}`;
    }
}

export function isSameDay(date1: Date, date2: Date): boolean {
    return (
        date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate()
    );
}

export function isToday(date: Date): boolean {
    return isSameDay(date, new Date());
}

export function getEventTimeDisplay(
    startOrEvent: string | { start_time?: string; end_time?: string; is_all_day?: boolean; start?: string; end?: string; is_day_event?: boolean },
    end?: string,
    isDayEvent?: boolean
): string {
    // If first argument is an event object
    if (typeof startOrEvent === 'object') {
        const event = startOrEvent;
        const isAllDay = event.is_all_day ?? event.is_day_event ?? false;
        const start = event.start_time ?? event.start ?? '';
        const end = event.end_time ?? event.end ?? '';
        
        if (isAllDay) {
            return 'All day';
        }
        
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        if (isSameDay(startDate, endDate)) {
            return `${formatTime(startDate)} - ${formatTime(endDate)}`;
        } else {
            const options: Intl.DateTimeFormatOptions = {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            };
            
            return `${startDate.toLocaleString('en-US', options)} - ${endDate.toLocaleString('en-US', options)}`;
        }
    } 
    else {
        const start = startOrEvent;
        const endValue = end || '';
        const isDayEventValue = isDayEvent || false;
        
        if (isDayEventValue) {
            return 'All day';
        }
        
        const startDate = new Date(start);
        const endDate = new Date(endValue);
        
        if (isSameDay(startDate, endDate)) {
            return `${formatTime(startDate)} - ${formatTime(endDate)}`;
        } else {
            const options: Intl.DateTimeFormatOptions = {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            };
            
            return `${startDate.toLocaleString('en-US', options)} - ${endDate.toLocaleString('en-US', options)}`;
        }
    }
} 